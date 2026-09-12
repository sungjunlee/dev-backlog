시뮬레이션으로만 답합니다. 아래 스크립트는 설치된 `dev-backlog/scripts/`에서 찾아 대상 저장소 루트에서 실행하는 것으로 가정합니다.

1. **ACTIONS:** `_context.md`와 활성 sprint를 읽고 → `status.sh --json`, `next.sh --json`으로 상태와 다음 live Issue·실행 가능한 배치를 확인한다.
   **MUTATIONS:** GitHub·로컬 모두 none. Orient만으로 구현하거나 Plan을 변경하지 않는다.
   **STOP/ASK:** no. 부분 완료 Plan은 정상적인 진행 상태다.

2. **ACTIONS:** 기존 활성 track과 신규 scope를 비교하고 sprint admission을 확인한다 → 겹치는 별도 track은 만들지 않는다. `sprint-init.js`도 중첩을 거부한다.
   **MUTATIONS:** 충돌 해소 전 none. 기존 sprint에 편입하거나 명시적으로 분리한 scope로 새 sprint를 만든다.
   **STOP/ASK:** 의도가 불분명하면 기존 track 편입과 scope 조정 중 선택을 묻는다. 기존 track을 임의로 완료 처리하지 않는다.

3. **ACTIONS:** `_context.md`와 두 활성 sprint를 읽고 → `status.sh --json`, `next.sh --json`으로 portfolio를 확인 → 필요하면 `--track auth`, `--track billing`으로 각각 확인한다.
   **MUTATIONS:** GitHub·로컬 모두 none.
   **STOP/ASK:** no. Disjoint active tracks는 허용되므로 각 track의 상태와 다음 배치를 보고한다.

4. **ACTIONS:** `setup-dev-backlog.js --tracker github --non-interactive` → live Issues를 검토하고 다중 Issue 순서·연속성 등 admission 근거 확인 → `sprint-init.js "topic"` → Goal·배치별 `#N` 체크박스·추정치를 작성한다.
   **MUTATIONS:** 로컬 `backlog/`와 admitted sprint를 생성한다. 근거 없는 `objectives`·`component`는 생략하고 scope는 명시적으로 정한 경우에만 `--scope`로 준다. GitHub 변경은 필요한 경우만 명시적으로 한다.
   **STOP/ASK:** spec·craftkit 부재로는 중단하지 않는다. 다만 admission 근거가 없다면 sprint를 억지로 만들지 않고 필요한 실행 복잡성을 확인한다.

5. **ACTIONS:** `setup-dev-backlog.js --tracker github --non-interactive` → `effective-task-spec.js '#N'` → 직접 구현·AC 검증 → PR → 완료 시 재해석·검증 후 merge 및 Issue closure.
   **MUTATIONS:** 로컬 bootstrap·구현 파일, GitHub PR·검증된 AC·lifecycle. Sprint나 로컬 task 사본은 만들지 않는다.
   **STOP/ASK:** no. 단일 독립 Issue는 sprint-free 기본 경로이며 Relay는 필수가 아니다.

6. **ACTIONS:** 존재하는 context·sprint를 읽고 → `effective-task-spec.js '#42'` → 반환된 effective AC에 따라 구현·각 항목 검증 → 완료 시 다시 resolve·검증한다.
   **MUTATIONS:** 구현 파일과 GitHub의 검증된 AC·PR·lifecycle. Sprint에 admitted된 경우만 Plan을 `[~]`와 branch/PR 포인터로 갱신하고 완료 후 `[x]`·Progress를 기록한다.
   **STOP/ASK:** 로컬 task 파일 부재로는 no. Effective spec이 live Issue의 세 AC라면 세 항목 모두 검증하며, resolution 실패 시 작업·AC/lifecycle 변경을 중단한다.

7. **ACTIONS:** 존재하는 `_context.md`·활성 sprint를 읽고, `backlog/`가 없으면 setup → `status.sh --json`, `next.sh --json` → 작업 착수 전 선택된 Issue를 `effective-task-spec.js`로 resolve한다.
   **MUTATIONS:** 필요한 bootstrap 외 none. 로컬 task 파일을 생성하거나 legacy export를 실행할 필요는 없다.
   **STOP/ASK:** no. 온라인 GitHub가 task truth이며, 구체적 구현 요청이 없다면 orientation 결과를 보고한다.

8. **ACTIONS:** 로컬 `_context.md`·활성 sprint·관련 저장소 파일로 확인 가능한 상태를 파악한다 → GitHub 접근 실패를 진단하고 live Issue·다음 작업은 확인 불가로 표시한다.
   **MUTATIONS:** GitHub·로컬 모두 none. 로컬 Plan을 live specification 대신 사용하지 않는다.
   **STOP/ASK:** 구현과 AC/lifecycle 변경은 중단한다. Live resolution이 가능하도록 GitHub 접근 복구를 요청한다.

9. **ACTIONS:** Plan 완료를 확인하고 필요한 각 task를 재-resolve·AC 검증·closure한다 → `sprint-close.sh` 실행(복수 track이면 `--track`) → 성공 후 미래 작업에 필요한 Running Context를 `_context.md`로 승격한다.
   **MUTATIONS:** 필요한 GitHub AC·closure, sprint의 `status: completed`·최종 Progress, `_context.md`. 완료 sprint는 영구 기록으로 보존한다.
   **STOP/ASK:** Plan 미완료·검증 실패·close 실패 시 완료 처리를 멈춘다. 로컬 task 파일 부재는 장애가 아니다.

10. **ACTIONS:** `effective-task-spec.js TASK_REF`를 다시 실행해 `source_ref`·digest·AC·lifecycle을 비교한다 → 변경된 effective specification에 맞춰 구현·검증을 조정 → 완료 직전 재확인한다.
    **MUTATIONS:** 필요한 구현 수정과 현재 기준으로 검증된 GitHub AC·lifecycle; admitted sprint의 관련 진행 기록도 갱신한다. 예전 내용으로 Issue를 덮어쓰지 않는다.
    **STOP/ASK:** Resolution 실패 시 중단한다. 변경이 명확하고 승인된 범위라면 no; 요구사항 충돌이나 범위 판단이 필요하면 사용자에게 묻는다.
