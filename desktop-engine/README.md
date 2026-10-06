# SignalScript Engine

SignalScript 웹앱을 위한 Windows 로컬 전사 엔진입니다. `127.0.0.1`에서만 실행되며 음성이나 전사문을 외부로 전송하지 않습니다.

## 처음 한 번

1. 압축을 푼 폴더에서 `Install-Engine.cmd`를 두 번 클릭합니다. PowerShell을 직접 열 필요가 없습니다.
2. 약 466MB의 한국어 Whisper Small 모델을 내려받습니다.
3. `Start-Engine.cmd`를 실행합니다. 열린 창은 전사하는 동안 그대로 둡니다.
4. SignalScript Vercel 웹사이트를 열어 “로컬 엔진 연결됨” 상태를 확인합니다.

## 요구 사항

- Windows 10/11 x64
- Node.js 20 이상 (처음 한 번 [Node.js LTS](https://nodejs.org) 설치 필요)
- 인터넷 연결: 최초 엔진·모델 다운로드 때만 필요

## 보안

엔진은 `127.0.0.1`에서만 요청을 받고 Vercel과 localhost 웹페이지에서 온 요청만 허용합니다. 임시 음성 조각은 전사 뒤 즉시 삭제됩니다.
