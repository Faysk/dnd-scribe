#!/usr/bin/env python3
"""Check Cloudflare R2 API and S3-compatible credentials using .env.local."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import hmac
import json
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import quote, urlparse


def load_env(path: Path) -> dict[str, str]:
    values = {}
    for raw in path.read_text(errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def sign(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def signing_key(secret: str, date_stamp: str) -> bytes:
    k_date = sign(("AWS4" + secret).encode("utf-8"), date_stamp)
    k_region = sign(k_date, "auto")
    k_service = sign(k_region, "s3")
    return sign(k_service, "aws4_request")


def s3_request(values: dict[str, str], method: str, object_key: str, payload: bytes = b"") -> int:
    endpoint = values.get("R2_S3_ENDPOINT") or values.get("R2_ENDPOINT")
    parsed = urlparse(endpoint)
    host = parsed.netloc
    scheme = parsed.scheme or "https"
    bucket = values["R2_BUCKET"]
    access_key = values["R2_ACCESS_KEY_ID"]
    secret_key = values["R2_SECRET_ACCESS_KEY"]

    now = dt.datetime.now(dt.UTC)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    canonical_uri = "/" + quote(bucket, safe="") + "/" + quote(object_key, safe="/")
    url = f"{scheme}://{host}{canonical_uri}"
    payload_hash = hashlib.sha256(payload).hexdigest()
    headers = {
        "host": host,
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
    }
    if method == "PUT":
        headers["content-type"] = "text/plain"

    signed_header_keys = sorted(k.lower() for k in headers)
    canonical_headers = "".join(f"{k}:{headers[k]}\n" for k in signed_header_keys)
    signed_headers = ";".join(signed_header_keys)
    canonical_request = "\n".join([method, canonical_uri, "", canonical_headers, signed_headers, payload_hash])
    credential_scope = f"{date_stamp}/auto/s3/aws4_request"
    string_to_sign = "\n".join([
        "AWS4-HMAC-SHA256",
        amz_date,
        credential_scope,
        hashlib.sha256(canonical_request.encode()).hexdigest(),
    ])
    signature = hmac.new(signing_key(secret_key, date_stamp), string_to_sign.encode(), hashlib.sha256).hexdigest()
    authorization = f"AWS4-HMAC-SHA256 Credential={access_key}/{credential_scope}, SignedHeaders={signed_headers}, Signature={signature}"
    req_headers = {k: v for k, v in headers.items() if k != "host"}
    req_headers["Authorization"] = authorization
    data = payload if method in {"PUT", "POST"} else None
    request = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            response.read()
            return response.status
    except urllib.error.HTTPError as exc:
        exc.read()
        return exc.code


def cloudflare_bucket_check(values: dict[str, str]) -> tuple[int, bool]:
    url = f"https://api.cloudflare.com/client/v4/accounts/{values['R2_ACCOUNT_ID']}/r2/buckets"
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {values['CLOUDFLARE_API_TOKEN']}"})
    with urllib.request.urlopen(request, timeout=30) as response:
        body = json.loads(response.read().decode("utf-8"))
    buckets = (body.get("result") or {}).get("buckets") or []
    names = [bucket.get("name") for bucket in buckets if isinstance(bucket, dict)]
    return response.status, values.get("R2_BUCKET") in names


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    args = parser.parse_args()
    values = load_env(args.env_file)

    api_status, bucket_present = cloudflare_bucket_check(values)
    key = "codex-healthcheck/healthcheck.txt"
    put_status = s3_request(values, "PUT", key, b"ok\n")
    head_status = s3_request(values, "HEAD", key)
    delete_status = s3_request(values, "DELETE", key)

    print(f"cloudflare_api={api_status} bucket_present={bucket_present}")
    print(f"s3_put={put_status} s3_head={head_status} s3_delete={delete_status}")
    return 0 if api_status == 200 and bucket_present and put_status == 200 and head_status == 200 and delete_status in {200, 202, 204} else 1


if __name__ == "__main__":
    raise SystemExit(main())
