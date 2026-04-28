# VS Code Agent Harness Audit for Ritemark

Date: 2026-04-25

## TL;DR

Yes, today's VS Code agent experience is tightly connected to GitHub Copilot as the default product surface, but the underlying "agent harness" is broader than Copilot branding.

The harness is basically:

- chat/agent UX and session management in VS Code
- agent loop orchestration (plan -> tool call -> observe -> iterate)
- tool runtime and approvals (built-in, extension tools, MCP tools)
- safety controls (permissions, approvals, network/domain policies, MCP sandboxing)

This means we can integrate our own Ritemark agent system with the harness in multiple ways, but not every path gives us full control of orchestration.

## Straight Answers

1. Is VS Code "agent harness" only Copilot?
No. Copilot is the default service/product path, but tools, MCP, extension APIs, and local orchestration surfaces are broader.

2. Can our own agents run in VS Code?
Yes. We can integrate through MCP servers, extension tools, chat participants, and custom `.agent.md` agents.

3. Can we fully replace VS Code's agent loop with ours?
Partially. We can keep our own orchestration outside VS Code and use VS Code as tool host, but native first-class cloud flows are still Copilot-governed.

4. Is there lock-in risk?
Yes, if we let product semantics drift into Copilot-specific flows. Lower risk if we keep MCP/tool contracts as our main boundary.

5. Recommended architecture now?
Hybrid: use VS Code harness for UX/tooling controls, keep Ritemark orchestration policy as product authority.

## What "Agent Harness" Actually Means

In practical architecture terms, VS Code split agenting into layers:

1. Interaction layer: chat UI, agent/session pickers, tool picker, approvals UI, debug logs.
2. Orchestration layer: agent loop, planning modes, subagents, retry/autocorrect behavior.
3. Capability layer: built-in tools + extension-contributed tools + MCP tools.
4. Model/provider layer: Copilot models, BYOK models, and provider integrations.
5. Policy/safety layer: approval modes, org policies, network filters, MCP sandboxing.

Copilot is the default product path across these layers, but tooling and extension points expose a larger platform surface.

## Is It "Only Copilot"?

Short answer: no for tools/extensibility, mostly yes for first-class hosted agent products.

What is Copilot-tied today:

- Built-in AI features are described by VS Code as powered by GitHub Copilot + LLMs.
- Cloud agent and partner/third-party cloud-agent flows are routed through Copilot account/governance.
- Some model-provider APIs are still governed by Copilot policy/plan constraints.

What is not Copilot-only:

- Tool system itself (built-in + extension + MCP).
- Local agent workflows that can use workspace tools and MCP servers.
- Extension APIs for chat participants and language model tools.
- Workspace-level agent instructions (`AGENTS.md`) and custom agent definitions (`.agent.md`).

## How This Maps to Ritemark Agents

### Option A: Keep Ritemark as Primary Orchestrator, Use VS Code as Tool Host

Model:

- Ritemark agent loop stays in our system.
- VS Code harness is used mainly as tool execution and developer UX surface.
- Integration uses MCP + extension tools.

Pros:

- Maximum control over Ritemark behavior and brand voice.
- Easier to keep cross-client parity (desktop + web + other surfaces).
- Lower lock-in to Copilot-specific roadmap shifts.

Tradeoffs:

- We own more orchestration code.
- Need explicit mapping between our planner/executor states and VS Code tool calls.

### Option B: Use VS Code Agent Loop, Plug in Ritemark Capabilities as Tools/Agents

Model:

- VS Code orchestrates the loop.
- We contribute Ritemark capabilities as MCP servers, extension tools, custom agents, skills/hooks.

Pros:

- Faster delivery of agent UX improvements (debug panel, approvals, permissions, subagents).
- Less infra work for session lifecycle and tool invocation UX.

Tradeoffs:

- Product behavior partially inherits Copilot/VS Code interaction model.
- Harder to enforce Ritemark-specific orchestration semantics end-to-end.

### Option C: Hybrid (Recommended for Sprint 57 Direction)

Model:

- Near-term: adopt upstream harness improvements for trust/controls/tooling.
- Mid-term: keep Ritemark-specific orchestration policies in our own layer where it matters.
- Build adapters so one capability can run in both harnesses.

Pros:

- Best risk/reward balance.
- Lets us benefit from upstream pace without surrendering product differentiation.

Tradeoffs:

- Requires clear ownership boundaries between "platform behavior" and "Ritemark behavior".

## Architectural Compatibility Checklist

For our system, these are the key compatibility questions:

1. Identity and entitlement: can Ritemark users access needed agent flows without forcing Copilot-only commercial assumptions?
2. Tool contracts: are our current tools better exposed as MCP servers, extension tools, or both?
3. Orchestration authority: which decisions stay in Ritemark (planning/autonomy policy), which can be delegated to VS Code?
4. Safety model parity: do VS Code approvals/network filters/MCP sandbox controls match Ritemark safety requirements?
5. Instruction model: how do `AGENTS.md`, `.agent.md`, and our existing instruction stack coexist without contradiction?
6. Observability: can Agent Debug logs and our telemetry produce one coherent trace for troubleshooting?

## Recommended Integration Pattern for Ritemark

Adopt a hybrid architecture with explicit boundaries:

- VS Code harness owns: session UX, tool approvals, low-level tool execution plumbing, local safety controls.
- Ritemark owns: product-level orchestration policy, task templates, instruction hierarchy, user-facing product semantics.
- Shared protocol boundary: MCP and typed tool contracts so capabilities remain portable outside VS Code.

This prevents us from becoming "just a Copilot skin" while still using upstream agent platform gains.

## What to Audit Next (Concrete)

1. Build a capability inventory of current Ritemark agent actions and classify each as:
- "MCP-ready"
- "Extension-tool-ready"
- "Ritemark-orchestrator-only"

2. Run a small proof-of-integration:
- one Ritemark tool via MCP
- one via extension-contributed tool
- one workflow through custom `.agent.md` handoff

3. Validate governance:
- approval flows
- `chat.agent.networkFilter` policy behavior
- MCP sandbox behavior (`sandboxEnabled`) in macOS/Linux dev environments

4. Confirm instruction precedence with our existing `AGENTS.md` usage in this monorepo.

## Key Sources

- VS Code AI extensibility overview: https://code.visualstudio.com/api/extension-guides/ai/ai-extensibility-overview
- Language Model Tools API: https://code.visualstudio.com/api/extension-guides/ai/tools
- Chat Participant API: https://code.visualstudio.com/api/extension-guides/ai/chat
- MCP developer guide: https://code.visualstudio.com/api/extension-guides/ai/mcp
- Agents concepts: https://code.visualstudio.com/docs/copilot/concepts/agents
- Using agents overview: https://code.visualstudio.com/docs/copilot/agents/overview
- Use tools with agents: https://code.visualstudio.com/docs/copilot/agents/agent-tools
- Custom agents (`.agent.md`): https://code.visualstudio.com/docs/copilot/customization/custom-agents
- Custom instructions (`AGENTS.md`): https://code.visualstudio.com/docs/copilot/customization/custom-instructions
- VS Code 1.112 release notes (MCP sandboxing): https://code.visualstudio.com/updates/v1_112
- VS Code 1.116 release notes (network policy + built-in Copilot): https://code.visualstudio.com/updates/v1_116
- VS Code 1.110 release notes (Agent Debug panel): https://code.visualstudio.com/updates/v1_110
- Agent mode + MCP blog: https://code.visualstudio.com/blogs/2025/04/07/agentMode
