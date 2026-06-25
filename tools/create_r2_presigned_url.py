#!/usr/bin/env python3
"""Create a temporary signed GET URL for a Cloudflare R2 object."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import hmac
import json
import urllib.parse
import urllib.request
from pathlib import Path


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
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


def find_key(manifest_path: Path, role: str) -> str:
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    for item in data.get("results") or data.get("objects") or []:
        if item.get("role") == role:
            return item["key"]
    raise SystemExit(f"role not found in manifest: {role}")


def canonical_query(params: dict[str, str]) -> str:
    parts = []
    for key in sorted(params):
        parts.append(
            urllib.parse.quote(key, safe="")
            + "="
            + urllib.parse.quote(params[key], safe="-_.~")
        )
    return "&".join(parts)


def create_url(values: dict[str, str], key: str, expires: int) -> str:
    endpoint = values.get("R2_S3_ENDPOINT") or values.get("R2_ENDPOINT")
    if not endpoint:
        raise SystemExit("R2_S3_ENDPOINT or R2_ENDPOINT not found in env file")
    parsed = urllib.parse.urlparse(endpoint)
    scheme = parsed.scheme or "https"
    host = parsed.netloc
    bucket = values["R2_BUCKET"]
    access_key = values["R2_ACCESS_KEY_ID"]
    secret_key = values["R2_SECRET_ACCESS_KEY"]

    now = dt.datetime.now(dt.UTC)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    credential_scope = f"{date_stamp}/auto/s3/aws4_request"
    canonical_uri = "/" + urllib.parse.quote(bucket, safe="") + "/" + urllib.parse.quote(key, safe="/")
    params = {
        "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
        "X-Amz-Credential": f"{access_key}/{credential_scope}",
        "X-Amz-Date": amz_date,
        "X-Amz-Expires": str(expires),
        "X-Amz-SignedHeaders": "host",
    }
    query = canonical_query(params)
    canonical_request = "\n".join(
        [
            "GET",
            canonical_uri,
            query,
            f"host:{host}\n",
            "host",
            "UNSIGNED-PAYLOAD",
        ]
    )
    string_to_sign = "\n".join(
        [
            "AWS4-HMAC-SHA256",
            amz_date,
            credential_scope,
            hashlib.sha256(canonical_request.encode()).hexdigest(),
        ]
    )
    signature = hmac.new(signing_key(secret_key, date_stamp), string_to_sign.encode(), hashlib.sha256).hexdigest()
    return f"{scheme}://{host}{canonical_uri}?{query}&X-Amz-Signature={signature}"


def check_url(url: str) -> int:
    request = urllib.request.Request(url, headers={"Range": "bytes=0-0"}, method="GET")
    with urllib.request.urlopen(request, timeout=30) as response:
        response.read(1)
        return response.status


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--role")
    parser.add_argument("--key")
    parser.add_argument("--expires", type=int, default=900)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    if not args.key:
        if not args.manifest or not args.role:
            raise SystemExit("Use --key or both --manifest and --role")
        key = find_key(args.manifest, args.role)
    else:
        key = args.key

    values = load_env(args.env_file)
    url = create_url(values, key, args.expires)
    if args.check:
        print(f"check_status={check_url(url)}")
    if not args.quiet:
        print(url)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
