시뮬레이션으로만 답합니다. 명령은 실행하지 않았습니다. 아래 스크립트는 설치된 `dev-backlog`의 `scripts/`에서 찾아 대상 저장소 루트에서 실행하는 것으로 가정합니다.

1.
ACTIONS: `_context.md` → 활성 스프린트의 Goal·Plan·Running Context·최신 Progress 확인 → `next.sh`·`status.sh` → 미완료 항목의 live Issue를 확인하고 다음 실행 배치를 제시한다. `[~]`는 진행 중으로 구분한다.
MUTATIONS: GitHub·로컬 모두 none.
STOP/ASK: no. 기존 스프린트 상태를 파악하며 새 스프린트를 만들지 않는다.

2.
ACTIONS: 기존 활성 트랙과 요청 범위 확인 → Sprint Admission 확인 → `sprint-init.js --dry-run`으로 중복 범위를 검증한다. 같은 범위의 작업은 기존 트랙에 수용하는 방향으로 계획한다.
MUTATIONS: 겹치는 새 활성 스프린트는 생성하지 않는다. 기존 트랙에 수용할 경우 그 Plan만 갱신한다. GitHub는 none.
STOP/ASK: 중복 활성 트랙 생성은 중단한다. 기존 트랙 수용과 범위 재설정 중 사용자 결정이 필요한 경우에만 묻는다. 범위를 임의로 축소하지 않는다.

3.
ACTIONS: `_context.md`와 두 스프린트를 읽고 `next.sh`·`status.sh`로 포트폴리오를 확인한다. auth·billing 각각의 상태와 다음 actionable 배치를 제시한다. 특정 트랙 실행 시 `--track <slug>`를 쓴다.
MUTATIONS: GitHub·로컬 모두 none.
STOP/ASK: no. 두 scope가 disjoint이므로 공존이 유효하다.

4.
ACTIONS: `setup-dev-backlog.js --tracker github --non-interactive` → `gh issue list`·`gh issue view`로 이슈·의존성 조사 → 다중 이슈 실행 등 admission 근거 확인 → `sprint-init.js --dry-run` 후 첫 활성 스프린트를 생성한다. 독립 항목은 같은 배치, 의존 항목은 후속 배치에 둔다.
MUTATIONS: GitHub는 none. 로컬에 GitHub tracker 설정과 Goal·순서·추정치·의존성이 담긴 스프린트를 만든다. `objectives:`·`component:`는 생략하고 spec 파일이나 관련 skill을 자동 생성·설치하지 않는다.
STOP/ASK: spec axis 부재만으로는 멈추지 않는다. admission 근거가 없다면 스프린트를 억지로 만들지 않고 필요한 실행 복잡성을 확인한다. scope는 추론하지 않는다.

5.
ACTIONS: `setup-dev-backlog.js --tracker github --non-interactive` → `effective-task-spec.js #N` → 직접 구현 → 모든 AC 검증 → PR 및 GitHub lifecycle 갱신 순으로 진행한다.
MUTATIONS: 로컬 tracker 설정·구현 파일, GitHub AC·lifecycle·PR. 스프린트나 task mirror는 생성하지 않는다.
STOP/ASK: no. 단일 독립 이슈는 sprint-free 경로이며 Relay는 필수가 아니다.

6.
ACTIONS: 존재하는 `_context.md`·활성 스프린트를 읽고 `effective-task-spec.js #42`로 effective spec·AC·lifecycle·source·digest를 확보한다 → 구현 → 세 AC 각각 검증 → GitHub에 반영한다.
MUTATIONS: 구현 파일과 검증된 GitHub AC·lifecycle. #42가 스프린트에 수용된 작업일 때만 Plan·Running Context·Progress도 갱신한다. task 파일은 만들지 않는다.
STOP/ASK: no. 단, live spec 해석 실패 시 중단하며 mirror로 실행을 정당화하지 않는다.

7.
ACTIONS: `_context.md`와 활성 스프린트를 확인한다. `backlog/`가 없으면 GitHub setup을 실행한다. 스프린트가 있으면 `next.sh`·`status.sh`, 없으면 `gh issue list`·`gh issue view`로 다음 live Issue를 선정한다.
MUTATIONS: GitHub는 none. 필요한 경우 로컬 tracker 초기화만 한다. orient를 위해 task 파일이나 스프린트를 생성하지 않는다.
STOP/ASK: no. 로컬 task 파일 없이도 온라인 GitHub에서 작업 정의를 확보할 수 있다.

8.
ACTIONS: 사용 가능한 `_context.md`·스프린트·저장소 파일로 마지막 기록 상태를 파악한다. `effective-task-spec.js TASK_REF`는 GitHub 접근 불가로 live 입력을 확보할 수 없음을 명시한다. legacy mirror는 진단 자료로만 취급한다.
MUTATIONS: GitHub·로컬 모두 none.
STOP/ASK: live spec이 필요한 구현·AC·lifecycle 변경은 중단하고 GitHub 접근 복구를 요청한다. 로컬 기록의 다음 후보를 현재 live Issue로 확정하지 않는다.

9.
ACTIONS: 스프린트 완료 조건을 확인한다 → `sprint-close.sh`를 실행하여 선행 doctor 검사와 `reassess_signal`을 확인한다 → 최종 Progress를 기록하고 미래 작업에 필요한 프로젝트 수준 Running Context를 `_context.md`로 승격한다.
MUTATIONS: 로컬 스프린트 `status: completed`·최종 Progress·`_context.md`. 스프린트 파일은 보존한다. 이미 완료된 GitHub lifecycle은 그대로 유지하며 task 디렉터리를 만들지 않는다.
STOP/ASK: no. 미완료 작업이나 검사 실패가 있으면 해결 전 종료를 중단한다. reassess 권고만으로 `spec/*`를 자동 수정하지 않는다.

10.
ACTIONS: `effective-task-spec.js TASK_REF`를 다시 실행한다 → 이전 digest·effective spec·AC와 비교한다 → 변경된 유효 요구사항에 구현·검증을 맞춘다 → GitHub와 해당 스프린트 진행 상태를 갱신한다. 명시적 `spec_ref`가 있으면 그 우선권을 유지한다.
MUTATIONS: 필요한 구현 파일·검증된 GitHub AC/lifecycle 및 수용된 스프린트 기록. background sync·mirror export·tracker 전환은 하지 않는다.
STOP/ASK: 변경이 명확하면 no. 해석 실패나 요구사항 충돌로 실행 기준이 불명확하면 해당 작업을 멈추고 확인한다.
