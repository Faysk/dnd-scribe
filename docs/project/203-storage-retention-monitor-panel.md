# 203 - Storage retention monitor panel

Date: 2026-07-02
Status: implemented

## Goal

Storage must be visible before it becomes expensive. The current production
problem is clear: raw ZIP/FLAC/WAV artifacts can grow quickly, while the project
only needs compact evidence after processing.

This step adds a retention policy panel to the Monitor page.

## What the panel shows

The panel summarizes:

- total tracked storage;
- operational usage percentage;
- target retained size per session;
- average retained size per session;
- ZIP warning threshold;
- objects already marked `delete_ready`.

This gives the operator a direct answer to:

```text
Estamos guardando o bruto ou o que realmente presta?
```

## Retention principle

Keep:

- manifests;
- participant metadata;
- compact audio evidence;
- transcripts;
- timing data;
- review decisions;
- operational logs.

Remove only after safe evidence exists:

- Craig ZIP;
- extracted full FLAC tracks;
- transient WAV chunks;
- temporary worker artifacts.

## Safety

Deletion remains explicit and evidence-based. The monitor can show what is ready
to delete, but the cleanup process still depends on safe markers and session
state. Failed or partially processed sessions should not lose original evidence.

## Cost

This panel does not create new storage or OpenAI usage. It only surfaces metrics
already computed by the monitoring backend.
