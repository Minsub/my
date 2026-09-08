# Google 로그인 직접 만들기

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 선택/생성한다. 앱 코드의 이름은 MONO지만 기존 Cloud 프로젝트 이름을 바꿀 필요는 없다.
2. Google Auth Platform(또는 APIs & Services → OAuth consent screen)에서 앱 이름 **MONO**, 지원/연락 이메일, 대상 사용자(Audience)를 설정한다. 여러 개인 Google 계정이 사용할 경우 External을 선택한다.
3. 개발 중 Testing이면 로그인할 계정을 Test users에 추가한다. 공개 사용 단계의 Publishing status/검증 요구는 콘솔 안내에 따른다. Google 쪽 사용 가능 여부와 MONO의 OWNER_EMAIL/초대 허용은 별개다.
4. Clients → Create client → **Web application**을 만든다.
5. Authorized JavaScript origins에 운영 origin과 필요한 로컬 origin을 넣는다.
6. Authorized redirect URIs에는 다음을 정확히 등록한다. 경로·포트·프로토콜이 달라지면 redirect_uri_mismatch가 발생한다.

```text
https://실제운영도메인/api/auth/callback/google
http://localhost:3000/api/auth/callback/google
```

7. 발급된 Client ID와 Client Secret을 로컬/운영 환경의 GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET에 저장한다. 운영은 Vercel Production에 등록 후 재배포한다. 비밀번호나 OAuth secret을 코드에 넣지 않는다.
8. OWNER_EMAIL로 처음 로그인한다. 앱은 그 이메일의 검증된 계정에 공간과 관리자 권한을 만든다. 이후 구성원은 앱 설정에서 이메일 허용 후 각자 Google로 로그인한다. 초대 이메일을 자동 발송하지는 않는다.

[Google 웹 서버 OAuth와 redirect URI](https://developers.google.com/identity/protocols/oauth2/web-server)

Google 동의 화면의 앱 이름/홈페이지/개인정보 안내는 코드와 별개로 관리한다. 홈페이지는 운영 origin, 개인정보 안내는 `/privacy`를 사용한다. 기존 프로젝트를 사용할 때 표시 이름만 바꾸기 위해 Client ID/Secret을 재발급할 필요는 없다.

문제 해결: redirect_uri_mismatch는 실제 요청 주소와 등록값 비교, access_denied는 Google 테스트 사용자/조직 정책 및 MONO 초대 확인, 로그인 후 접근 거부는 OWNER_EMAIL·검증된 이메일·활성 구성원 확인. MCP의 추가 동의는 우리 앱에서 발급하는 OAuth이며 Google 로그인 토큰을 직접 붙이는 방식이 아니다.
