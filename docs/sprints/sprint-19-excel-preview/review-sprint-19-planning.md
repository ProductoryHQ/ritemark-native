# Sprint 19 Planning Review

Date: 2026-01-12  
Reviewer: Codex  
Scope: Sprint 19 Excel Preview planning documents

## Findings (ordered by severity)

1.  High - Documentation contradictions on scope
    

-   `PHASE-1-SUMMARY.md` states "No changes needed: Webview components" while  
    `sprint-plan.md` includes multi-sheet UI changes to `SpreadsheetViewer.tsx`.
    
-   This creates confusion about whether multi-sheet support is in scope or a  
    later enhancement.
    

2.  High - Phase gate status inconsistencies
    

-   `PHASE-1-SUMMARY.md` says Phase 2 is "READY TO START".
    
-   `PHASE-2-READY-FOR-APPROVAL.md` says Phase 2 is "COMPLETE".
    
-   This makes the approval gate ambiguous.
    

3.  Medium - Sheet switching re-sends full Base64 payload
    

-   Plan sends full Base64 content on every sheet change.
    
-   For large files, this can be slow and re-parses the workbook each time.
    
-   Consider caching in the webview or provider to reduce parsing and payload size.
    

4.  Medium - Synchronous file IO in provider sample
    

-   `openCustomDocument()` uses `fs.readFileSync` in the example.
    
-   For large files this can block the extension host.
    
-   Prefer `fs.promises.readFile` with `await`.
    

5.  Low - Size warning and row limit are described inconsistently
    

-   Risk section mentions a 5MB warning; success criteria mentions 10k row limit.
    
-   Ensure both are described consistently and enforced in one location.
    

## Suggestions

-   Align scope and status across docs:
    
    -   Make Phase 2 "scope expansion" explicit if multi-sheet UI was added later.
        
    -   Use consistent phase labels in `STATUS.md`, `PHASE-1-SUMMARY.md`, and  
        `PHASE-2-READY-FOR-APPROVAL.md`.
        
-   Add a brief "Message Protocol" section to `sprint-plan.md` defining:
    
    -   webview -> extension: `ready`, `change-sheet`
        
    -   extension -> webview: `load`, `error`
        
    -   required payload fields (filename, encoding, sheets, currentSheet, sizeBytes)
        
-   Decide on a caching approach and document it:
    
    -   Webview cache: parse workbook once, switch sheets client-side.
        
    -   Provider cache: keep parsed workbook or decoded ArrayBuffer, send sheets only.
        
-   Define error UX explicitly:
    
    -   In-webview error panel vs VS Code notification.
        
    -   Test expectations for corrupted files.
        

## Questions

1.  Is multi-sheet UI an approved Phase 2 scope addition or should it be a later  
    enhancement?
    
    1.  ANswer by JARMO: Yes multi-sheet is approved
        
2.  For sheet switching, do you want instant response (cache) or is on-demand  
    re-parse acceptable?
    
    1.  answer by JARMO: instant is better
        
3.  Should errors render in the webview (preferred for consistency) or as VS Code  
    notifications?
    
    1.  ANSWER BYT JARMO:render errors in easy way - choose whatever is simpler.
        

## Summary

Planning is solid and low-risk, but scope and phase status should be aligned  
across documents. Performance and UX details around sheet switching and error  
handling would benefit from explicit decisions in the plan.