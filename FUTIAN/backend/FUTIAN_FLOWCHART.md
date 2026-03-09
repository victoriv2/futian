# FUTIAN AI Response Flowchart

This flowchart illustrates the logic pipeline used by the FUTIAN backend (`main.py`) to process user requests, retrieve information, and generate responses.

```mermaid
graph TD
    %% Nodes
    User([User Input])
    Preproc[Preprocessing]
    
    subgraph Analysis
        Expand[Expand Abbreviations<br/>(e.g. 'vc' -> 'Vice Chancellor')]
        Typos[Typo Detection<br/>(Fuzzy Match Names/Buildings)]
        Intent{Map/Direction<br/>Request?}
        ImgPrep[Prepare Building Images<br/>& Navigation Instructions]
    end

    subgraph Step1_Local[Step 1: Local Data]
        Context[Get Smart Context<br/>(Retrieve relevant JSON chunks)]
        Prompt1[Construct Prompt<br/>(Strict Local Data Only)]
        AI1[[AI Model Call<br/>(xAI Grok)]]
        Check1{Answer Found?}
    end

    subgraph Step2_Web[Step 2: Web Search]
        Search[Web Search<br/>(site:futia.edu.ng)]
        Prompt2[Construct Prompt<br/>(Web Snippets)]
        AI2[[AI Model Call]]
        Check2{Answer Found?}
    end

    subgraph Step3_General[Step 3: General Knowledge]
        Prompt3[Construct Prompt<br/>(General Knowledge Fallback)]
        AI3[[AI Model Call]]
    end

    Response([Send Response to User])

    %% Flow
    User --> Preproc
    Preproc --> Expand
    Expand --> Typos
    Typos --> Intent
    
    Intent -- Yes --> ImgPrep
    ImgPrep --> Context
    Intent -- No --> Context
    
    Context --> Prompt1
    Prompt1 --> AI1
    AI1 --> Check1
    
    Check1 -- Yes --> Response
    Check1 -- No --> Search
    
    Search --> Prompt2
    Prompt2 --> AI2
    AI2 --> Check2
    
    Check2 -- Yes --> Response
    Check2 -- No --> Prompt3
    
    Prompt3 --> AI3
    AI3 --> Response
```

## Detailed Explanation

1.  **Preprocessing**: The system standardizes the input (expanding "vc" to "Vice Chancellor") and checks for typos in known building or written names.
2.  **Intent Analysis**: It checks if the user is asking for a location or map. If so, it pre-fetches image URLs and explicitly instructs the AI to show them.
3.  **Step 1 (Local Data)**: 
    *   The system searches its loaded JSON memory for keywords.
    *   It retrieves the most relevant text chunks.
    *   It asks the AI to answer *strictly* using this data. If it can't, the AI returns "NO_DATA_FOUND".
4.  **Step 2 (Web Search)**: 
    *   If Step 1 fails, the system searches `futia.edu.ng` via DuckDuckGo.
    *   It feeds the search snippets to the AI.
5.  **Step 3 (General Knowledge)**:
    *   If both Local and Web data fail, the system allows the AI to use its own general training to answer the question, while warning that it might not be specific to FUTIA.
