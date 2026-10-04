# Project guide

[Back to the README](../README.md).

## Bundled agents

| Profile | Purpose |
| --- | --- |
| `personal-agent` | Candidate/resume assistant using a local knowledge base; current default |
| `customer-service` | Coffee-shop support example with a bundled knowledge base |
| `research-analyst` | Public research, page fetching, and calculations |
| `sales-concierge` | Catalog lookup, lead qualification, and checkout previews |
| `bzs-concierge` | Workflow-consulting discovery and lead previews |
| `frampton` | Dark Souls guide using bundled public wiki material |

Profiles gate which tools an agent can use. Sales tools are previews: they do
not persist leads to a CRM or charge customers. New business profiles can be
added without changing the engine.

## Add an agent

Create `profiles/<id>/profile.json` and a `system.md` prompt. For example:

```json
{
  "id": "my-agent",
  "label": "My Agent",
  "description": "Answers questions about our business",
  "kb_root": "kb/my-agent",
  "system_prompt_path": "profiles/my-agent/system.md",
  "tools": ["list_kb", "read_file", "search_kb"]
}
```

Plain-English procedures live at `profiles/<id>/skills/<slug>/SKILL.md`, with
`name` and `description` frontmatter. Their bodies are loaded as tool results,
keeping the model's system prompt stable for caching. MCP configuration is
parsed but no MCP client connects yet.

## Knowledge and evaluations

Semantic retrieval is opt-in through the `semantic_search_kb` tool. Build a
profile index explicitly after changing its knowledge base:

```bash
.venv/bin/python -m runnrr.rag.cli build customer-service
.venv/bin/python -m runnrr.rag.cli info customer-service
.venv/bin/python -m runnrr.rag.cli query customer-service "opening hours" --k 3
```

Voyage embeddings require `VOYAGE_API_KEY`. Tests use deterministic fixtures.
Indexes live under `profiles/<id>/.index/` and are ignored by Git. Chat never
rebuilds an index automatically; restart the runtime after rebuilding.

```bash
.venv/bin/python -m runnrr.evals.cli --backend fake run customer-service \
  --mode retrieval-only --variants keyword,hybrid --k 5
.venv/bin/python -m runnrr.evals.cli list customer-service
```

Evaluation datasets live with profiles and outputs are ignored under
`profiles/<id>/evals/runs/`. `ENABLE_EVALS_API=1` enables the read-only eval endpoints.
