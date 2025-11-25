# In-App Dify Agent Integration Plan

## Overview
Integrate Dify-powered AI agent capabilities into the BabblinGo mobile app.
The system will support **Multiple Agents** managed via the Admin Panel.
The implementation will use a **Backend Proxy** pattern to secure API keys and manage request context.

## Phase 1: Backend (Payload CMS)

- [ ] **Create `Agents` Collection**
    - [ ] Create new collection `Agents`.
    - [ ] Fields:
        - `title`: Text (required, localized).
        - `description`: Textarea (localized).
        - `icon`: Upload (relationship to `media`).
        - `difyApiKey`: Text (required, protected - hidden from public API).
        - `welcomeMessage`: Text (localized, optional override).
        - `order`: Number (for sorting).
        - `status`: Select (Draft/Published).
    - [ ] Access Control:
        - Public: Read-only (exclude `difyApiKey`).
        - Admin: Full access.

## Phase 2: Backend (NestJS Proxy)

- [ ] **Configuration**
    - [ ] Add environment variable `DIFY_API_URL` (e.g., `https://api.dify.ai/v1`).

- [ ] **Dify Module**
    - [ ] Create `DifyModule`, `DifyService`, and `DifyController`.
    - [ ] Implement `DifyService`:
        - Method `sendMessage(userId: string, agentId: string, query: string, conversationId?: string, inputs?: Record<string, any>)`.
        - Logic:
            1. Fetch `Agent` document by `agentId`.
            2. Decrypt/Retrieve `difyApiKey` from the document.
            3. Forward request to Dify API (`POST /chat-messages`) using that specific key.
        - Map Dify response format to a clean frontend DTO.
    - [ ] Implement `DifyController`:
        - `POST /api/dify/chat`: Accepts `{ agentId, query, conversationId, inputs }`.
        - Protect with `JwtAuthGuard`.

## Phase 3: Frontend (Expo/React Native)

- [ ] **Agent List UI**
    - [ ] Update `Home` tab to show an item named `BabblinGears` similar to courses, and display a list of available agents when tapped to open a detail page.
    - [ ] Fetch agents from `/api/agents` (filtered by status=published).
    - [ ] Display Icon, Title, and Description.

- [ ] **Chat Interface**
    - [ ] Create `app/(stack)/agent/[agentId].tsx`.
    - [ ] Create `ChatInterface` component:
        - Message list (Bubble UI).
        - Input area.
        - Loading states.
    - [ ] State Management (`useDifyChat` hook):
        - Handle `sendMessage` (call proxy with `agentId`).
        - Persist `conversation_id` per agent (e.g., `chat_session_{agentId}`).

## Phase 4: Context & Refinement

- [ ] **Context Injection**
    - [ ] Allow passing current `courseId` or `lessonId` as `inputs` if launched from a lesson context.

- [ ] **Streaming (Optional/Later)**
    - [ ] Investigate Server-Sent Events (SSE) for streaming responses.

## Phase 5: Testing

- [ ] **Backend Tests**
    - [ ] Verify `difyApiKey` is not exposed in public API responses.
    - [ ] Test proxy logic with multiple agents.

- [ ] **Frontend Tests**
    - [ ] Test Agent List rendering.
    - [ ] Test Chat Interface with different agents.

## Security Considerations
- **Never** expose `difyApiKey` to the client.
- Rate limit endpoints if necessary.

