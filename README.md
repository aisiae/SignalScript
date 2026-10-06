# SignalScript

시스템 오디오와 마이크를 함께 받아 사용자의 Windows PC에서 Whisper.cpp로 전사하는 무료 웹앱입니다. Vercel은 화면만 제공하며, 음성·전사문은 서버나 외부 API로 전송하지 않습니다.

## 사용 방법

1. `desktop-engine` 폴더에서 엔진을 설치하고 실행합니다.
2. Chrome 또는 Edge에서 사이트를 열고 “로컬 엔진 연결됨”을 확인합니다.
3. **연결하고 시작**을 누르고, 공유 창에서 **전체 화면**과 **시스템 오디오 공유**를 선택합니다.
4. 마이크 권한을 허용합니다.
5. 전사문을 편집, 복사하거나 TXT로 저장합니다.

## 웹앱 배포

정적 파일만 사용하는 앱입니다. GitHub에 올린 뒤 Vercel에서 해당 저장소를 Import하면 빌드 설정 없이 배포할 수 있습니다.

## 로컬 엔진

Windows 설치 및 실행 방법은 [desktop-engine/README.md](desktop-engine/README.md)를 참고하세요.

## 제한 사항

- 브라우저 보안 정책상 매번 시스템 오디오 공유를 사용자가 직접 허용해야 합니다.
- 첫 설치 때 한국어 Whisper Small 모델(약 466MB)을 PC에 내려받습니다.
- 시스템 오디오 공유는 Chrome/Edge 및 Windows에서 가장 안정적입니다.
