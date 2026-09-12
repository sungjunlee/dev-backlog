아래는 제공된 스킬에 따른 **가상 수행 절차**이며 실제 명령 실행·파일 접근·변경은 하지 않습니다. 명령의 `$skill_dir`는 설치된 dev-backlog 스킬 디렉터리이며, 실행 위치는 대상 저장소 루트입니다.

1. **ACTIONS:** `_context.md` → 활성 스프린트의 Goal·Plan·Running Context·최신 Progress를 읽고, `bash "$skill_dir/scripts/next.sh"`로 첫 미완료 실행 가능 배치를 확인한다. 현재 상태와 최신 Progress를 함께 보고한다.
   **MUTATIONS:** GitHub·로컬 모두 none.
   **STOP/ASK:** no.

2. **ACTIONS:** 기존 활성 트랙과 요청 범위를 비교하고, `scopesOverlap` 기준으로 충돌하는 트랙을 명시하여 신규 활성 스프린트 생성을 거부한다.
   **MUTATIONS:** GitHub·로컬 모두 none.
   **STOP/ASK:** 중단한다. 실제로 분리된 `component:` 또는 `scope:`를 선언하거나 충돌 트랙을 먼저 완료해야 한다. 충돌을 피하려고 범위를 임의로 바꾸지 않는다.

3. **ACTIONS:** `_context.md`와 두 Plan을 읽고 `status.sh`·`next.sh`로 auth·billing의 현재 상태와 다음 배치를 각각 보고한다. `next.sh --track auth`로 auth를 선택하며, `node "$skill_dir/scripts/backlog-doctor.js"`에서 범위 충돌이 없음을 확인한다.
   **MUTATIONS:** GitHub·로컬 모두 none.
   **STOP/ASK:** no. 두 범위는 분리되어 있어 공존할 수 있다.

4. **ACTIONS:** `node "$skill_dir/scripts/setup-dev-backlog.js" --tracker github --non-interactive` → `gh issue list`·`gh issue view`로 이슈와 스프린트 admission 조건 확인 → `sprint-init.js "first-sprint" --dry-run` 검토 → 실제 생성 순으로 진행한다.
   **MUTATIONS:** 로컬에 GitHub 추적 설정과 활성 스프린트의 Goal·순서 있는 Plan·추정치·의존성을 기록한다. `objectives:`·`component:`는 생략하고, 병렬 안전한 항목만 같은 배치에 둔다. GitHub 변경은 필수 아님.
   **STOP/ASK:** admission 조건을 충족하면 no. 충족하지 않으면 스프린트 없이 진행하며, spec 스킬 설치나 없는 `spec-charter` 경로를 요구하지 않는다.

5. **ACTIONS:** `setup-dev-backlog.js --tracker github --non-interactive` → `effective-task-spec.js <이슈번호>` → 직접 구현 → AC 검증 → PR → 완료 조건 충족 후 Issue 종료 순으로 진행한다.
   **MUTATIONS:** 구현 파일과 최소 추적 설정, GitHub AC·상태·PR을 변경한다. 스프린트·로컬 task mirror·Projects 보드·생성 메모리는 만들지 않는다.
   **STOP/ASK:** no. 단일 독립 이슈에는 스프린트나 Relay가 필요하지 않다.

6. **ACTIONS:** 세션 컨텍스트 확인 후 `node "$skill_dir/scripts/effective-task-spec.js" 42`로 유효 명세·출처·digest·AC·lifecycle을 확인한다. 구현하고 세 AC를 각각 검증한 뒤 GitHub에 반영한다.
   **MUTATIONS:** 구현 파일과 GitHub의 검증된 AC·lifecycle을 갱신한다. admitted sprint에 속한 경우에만 Plan·Running Context·Progress도 갱신하며 로컬 task 파일은 생성하지 않는다.
   **STOP/ASK:** 정상 해결되면 no. 명세 해석에 실패하면 작업·lifecycle 변경 전에 중단한다.

7. **ACTIONS:** 존재하는 `_context.md`와 활성 스프린트를 읽고 `status.sh --json`·`next.sh --json`으로 연속성을 복구한다. 스프린트가 없으면 live Issue를 조회하고 `effective-task-spec.js <이슈번호>`로 명세·AC·lifecycle을 확인한다. 명시적 단일 `spec_ref`가 우선한다.
   **MUTATIONS:** 복구·조회 단계는 none. `backlog/` 자체가 없다면 GitHub setup만 수행하며, task mirror는 생성하지 않는다.
   **STOP/ASK:** no. 로컬 task 파일 부재는 장애가 아니다.

8. **ACTIONS:** 저장소의 `_context.md`·스프린트와 `status.sh --json`·`next.sh --json`에서 실행 연속성 및 모든 `[~]` 항목의 담당자·작업 포인터를 복구한다. 없는 정보는 미확인으로 보고한다.
   **MUTATIONS:** GitHub·로컬 모두 none. legacy export를 대체 명세로 읽거나 tracker를 전환하지 않는다.
   **STOP/ASK:** live task를 해석할 수 없으므로 구현·AC 검증 주장·lifecycle 변경 전에 중단하고 GitHub 접근 복구가 필요함을 알린다.

9. **ACTIONS:** 스프린트 완료 조건을 확인하고 `bash "$skill_dir/scripts/sprint-close.sh"`를 실행한다. 내장 doctor의 결과·`reassess_signal`을 확인하고 최종 Progress와 미래 작업에 필요한 컨텍스트 승격을 마무리한다.
   **MUTATIONS:** 스프린트를 `completed`로 전환하고 영구 보존하며, 프로젝트 수준 Running Context를 `_context.md`로 옮긴다. `backlog/tasks/`·`backlog/completed/`는 만들지 않고 `spec/*`도 자동 수정하지 않는다. GitHub는 필요한 미완료 lifecycle 정리가 있을 때만 변경한다.
   **STOP/ASK:** 완료 조건과 검사에 문제가 없으면 no. 여러 활성 트랙이면 대상에 `--track <slug>`를 사용한다.

10. **ACTIONS:** `effective-task-spec.js <이슈번호>`를 다시 실행하여 이전 source_ref·digest와 새 revision을 비교한다. 변경된 유효 명세와 AC를 검토하고 구현·검증 범위를 조정한다.
    **MUTATIONS:** 필요한 구현과 검증된 GitHub AC·lifecycle, admitted sprint의 실행 기록만 갱신한다. 로컬 task 파일이나 백그라운드 sync는 만들지 않는다.
    **STOP/ASK:** 변경이 명확하면 no. 해석 실패나 요구사항 충돌이면 관련 작업을 멈추고 확인한다. `sync-pull.js --legacy-export`는 명시적 rollback·진단 요청에만 사용한다.
