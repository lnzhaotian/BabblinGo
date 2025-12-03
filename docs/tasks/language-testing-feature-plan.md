# Language Testing & Adaptive Assessment Feature Plan

## 1. Executive Summary
This document outlines the architectural plan for implementing a robust Language Testing System in BabblinGo. The system is designed to support various testing methodologies, from simple linear questionnaires to complex Computerized Adaptive Testing (CAT) that dynamically adjusts difficulty based on user performance.

## 2. Architecture Overview
We will adopt a **Server-Authoritative Session Model**. 
- **Security**: Correct answers and logic are hidden from the client.
- **Flexibility**: The logic for selecting the "next question" resides on the server, allowing us to update testing algorithms without releasing app updates.
- **Statefulness**: If a user drops out (network issue), they can resume exactly where they left off.

## 3. Database Schema (Payload CMS)

We will introduce three new collections to the Backend.

### 3.1. `QuestionBank` (The Content)
A repository of atomic assessment items.
*   **Fields**:
    *   `type`: Select (`multiple_choice`, `fill_blank`, `matching`, `listening_comprehension`, `reading_comprehension`, `speaking`).
    *   `difficulty_cefr`: Select (A1, A2, B1, B2, C1, C2).
    *   `difficulty_actfl`: Select (Novice Low, Novice Mid, Novice High, Intermediate Low, Intermediate Mid, Intermediate High, Advanced Low, Advanced Mid, Advanced High, Superior, Distinguished).
    *   `tags`: Relationship to `Skills` or simple Tags (e.g., "grammar", "business", "vocabulary").
    *   `stem`: RichText (The question text).
    *   `media`: Relationship to `Media` (Audio for listening, Images for context).
    *   `structure`: Blocks/JSON (Specific to `type`).
        *   *MCQ*: Options array, Correct Index.
        *   *Matching*: Pairs array.
        *   *FillBlank*: Text with `{{blank}}` placeholders and accepted answers.

### 3.2. `TestBlueprints` (The Logic)
Defines *how* a test is constructed and executed.
*   **Fields**:
    *   `title`: String.
    *   `description`: Text.
    *   `strategy`: Select (`linear`, `randomized_pool`, `adaptive_rule_based`).
    *   `config`: JSON (Configuration specific to the strategy).
        *   *Example (Adaptive)*:
            ```json
            {
              "initialDifficulty": "B1",
              "minQuestions": 15,
              "maxQuestions": 40,
              "stages": [
                { "name": "placement", "logic": "broad_jump" },
                { "name": "refinement", "logic": "narrow_focus" }
              ]
            }
            ```

### 3.3. `TestSessions` (The State)
Tracks a specific user's attempt at a test.
*   **Fields**:
    *   `user`: Relationship to `Users`.
    *   `blueprint`: Relationship to `TestBlueprints`.
    *   `status`: Select (`started`, `completed`, `abandoned`).
    *   `startTime`: Date.
    *   `endTime`: Date.
    *   `currentEstimate`: Number (Current estimated skill level).
    *   `history`: Array.
        *   `question`: Relationship to `QuestionBank`.
        *   `userAnswer`: JSON.
        *   `isCorrect`: Boolean.
        *   `timeTaken`: Number (seconds).
        *   `awardedScore`: Number.
    *   `finalResult`: JSON (Computed score, CEFR level, feedback).

## 4. The "Assessment Engine" (Backend Logic)

This is a service layer in the backend that handles the complexity.

### 4.1. Strategies
1.  **Linear**: Returns questions in a fixed order defined in the Blueprint.
2.  **Randomized Pool**: Selects $N$ questions randomly from specific tags/difficulties (e.g., "10 Grammar questions from Level A2").
3.  **Adaptive (CAT)**:
    *   **Phase 1 (Estimation)**: Serve questions with high discrimination at widely spaced difficulties (e.g., A1 -> B1 -> C1) to find a rough bracket.
    *   **Phase 2 (Refinement)**: Serve questions near the current estimated level. If correct -> slightly harder. If wrong -> slightly easier.
    *   **Phase 3 (Confirmation)**: Serve questions at the converged level to ensure consistency.

## 5. API Design

*   `POST /api/tests/start`:
    *   Input: `{ blueprintId: string }`
    *   Output: `{ sessionId: string, firstQuestion: QuestionObject }`
*   `POST /api/tests/:sessionId/submit`:
    *   Input: `{ questionId: string, answer: any }`
    *   Logic: Validates answer, updates `TestSession`, calculates next step.
    *   Output:
        *   If test continues: `{ status: "continue", nextQuestion: QuestionObject }`
        *   If test ends: `{ status: "completed", result: ResultObject }`
*   `GET /api/tests/:sessionId/history`: (Optional) For reviewing past answers.

## 6. Frontend Implementation (React Native)

### 6.1. Components
*   **`TestLandingScreen`**: Shows test info, "Start" button.
*   **`TestRunnerContainer`**: Manages the state machine (Loading -> Question -> Submitting -> Result).
*   **`QuestionRenderer`**: A switch component that renders the specific UI for the current question type (MCQ, Matching, etc.).
*   **`TestResultScreen`**: Visualizes the outcome (Score, Level, Radar Chart of skills).

### 6.2. State Management
*   Use `React Query` or local state to handle the async nature of fetching the "next question".
*   Robust error handling (if network fails during submit, retry logic is essential).

## 7. Development Roadmap

### Phase 1: Foundation (Weeks 1-2)
*   Implement `QuestionBank` and `TestBlueprints` collections in Payload.
*   Implement `TestSessions` collection.
*   Create the `Linear` strategy (Fixed list of questions).
*   Basic API endpoints (`start`, `submit`).

### Phase 2: Frontend Core (Weeks 3-4)
*   Build `QuestionRenderer` for:
    *   Multiple Choice.
    *   Fill in the Blank.
*   Build `TestRunner` flow.
*   Basic Result screen.

### Phase 3: Advanced Logic (Weeks 5-6)
*   Implement `Randomized Pool` strategy.
*   Implement `Adaptive` strategy (Rule-based MVP).
*   Add `Listening Comprehension` question type (Audio player integration).

### Phase 4: Polish & Analytics (Weeks 7-8)
*   Rich visualizations for results.
*   "My Test History" in user profile.
*   Admin dashboard to view test analytics (e.g., "Which questions are too hard?").
