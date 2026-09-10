"""Official Python MCP client used by TASK-230/S4 interoperability evidence.

The script intentionally contains no ERP business logic. It initializes the
official Python SDK client, lists the server tools, and invokes the G01 tools
selected by the caller. The caller owns the fixture token and exact reviewed
execution payload; no credential is printed.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import json
from typing import Any

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from mcp.types import Implementation


def jsonable(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json", by_alias=True)
    if isinstance(value, list):
        return [jsonable(item) for item in value]
    if isinstance(value, dict):
        return {key: jsonable(item) for key, item in value.items()}
    return value


def content_texts(result: Any) -> list[str]:
    return [
        item.text
        for item in result.content
        if getattr(item, "text", None) is not None
    ]


async def run(args: argparse.Namespace) -> dict[str, Any]:
    create_input = json.loads(args.create_input)
    headers = {
        "Authorization": f"Bearer {args.token}",
        "Accept": "application/json, text/event-stream",
        "MCP-Protocol-Version": args.protocol_version,
    }
    async with httpx.AsyncClient(headers=headers, timeout=30.0) as http_client:
        async with streamable_http_client(
            args.endpoint,
            http_client=http_client,
            terminate_on_close=False,
        ) as (read_stream, write_stream, _get_session_id):
            async with ClientSession(
                read_stream,
                write_stream,
                client_info=Implementation(name="erp-system-python-s4", version="1.27.2"),
            ) as session:
                initialized = await session.initialize()
                listed = await session.list_tools()
                search = await session.call_tool("receipt.search", {"limit": 100})
                replay = await session.call_tool("receipt_pack.create", create_input)
                conflicting_input = dict(create_input)
                conflicting_input["dateFrom"] = "2026-09-02"
                conflict = await session.call_tool(
                    "receipt_pack.create",
                    conflicting_input,
                )
                pack = await session.call_tool(
                    "receipt_pack.get",
                    {"packId": args.pack_id},
                )
                exported = await session.call_tool(
                    "receipt_pack.export",
                    {"packId": args.pack_id, "action": "view"},
                )

                resource_bytes = 0
                resource_sha256 = None
                for item in exported.content:
                    resource = getattr(item, "resource", None)
                    blob = getattr(resource, "blob", None)
                    if blob:
                        raw = base64.b64decode(blob, validate=True)
                        resource_bytes += len(raw)
                        resource_sha256 = hashlib.sha256(raw).hexdigest()

                return {
                    "client": "@modelcontextprotocol/python-sdk",
                    "version": "1.27.2",
                    "protocolVersion": initialized.protocolVersion,
                    "tools": [tool.name for tool in listed.tools],
                    "searchIsError": search.isError,
                    "search": jsonable(search.structuredContent),
                    "replay": jsonable(replay),
                    "conflict": {
                        "isError": conflict.isError,
                        "errorText": content_texts(conflict),
                    },
                    "pack": jsonable(pack),
                    "export": {
                        "isError": exported.isError,
                        "structuredContent": jsonable(exported.structuredContent),
                        "errorText": content_texts(exported),
                        "resourceByteLength": resource_bytes,
                        "resourceSha256": resource_sha256,
                    },
                }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--endpoint", required=True)
    parser.add_argument("--token", required=True)
    parser.add_argument("--pack-id", required=True, type=int)
    parser.add_argument("--create-input", required=True)
    parser.add_argument("--protocol-version", default="2025-11-25")
    result = asyncio.run(run(parser.parse_args()))
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
