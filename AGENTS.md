# Pebble Developer Knowledge Base Rules

The official Pebble Developer Documentation has been cloned locally to act as an agent-compatible knowledge base.

Whenever you need to look up documentation for the Pebble SDK, C API, PebbleKit JS, Guides, or Tutorials, you **MUST** search the local knowledge base rather than guessing or searching the web.

## Location
The markdown source for all Pebble documentation is located at:
`/.agents/knowledge/sdk-docs/source/`

### Key Directories to Search
- **Guides**: `/.agents/knowledge/sdk-docs/source/_guides/` (Contains best practices, how-tos for UI, communication, graphics, etc.)
- **Tutorials**: `/.agents/knowledge/sdk-docs/source/tutorials/` (Step-by-step examples for building watchfaces and watchapps)
- **C API Docs**: `/.agents/knowledge/sdk-docs/source/docs/c/` (Detailed C API references)
- **PebbleKit JS**: `/.agents/knowledge/sdk-docs/source/docs/pebblekit-js/` (JavaScript API for companion components)

## Instructions for Agents
1. **Search Before Coding**: If you are unsure about how a specific Pebble API works or how to implement a feature (e.g., Timeline, animations, persistent storage), use the `grep_search` tool in the above directories to find the relevant markdown documentation.
2. **Read Full Context**: Once you find a relevant markdown file via `grep_search`, use the `view_file` tool to read the entire guide or API reference before proceeding with implementation.
3. **Follow Best Practices**: The guides contain crucial information regarding memory limits, watchface performance, and Pebble-specific patterns (like event loops, memory allocation, and app messages). Always adhere to them.
