# PDF 변환기 - CAFE24 설치 가이드

Word(.doc/.docx), 한글(.hwp/.hwpx), PowerPoint(.ppt/.pptx) 파일을 PDF로 변환하는 웹사이트입니다.

---

## 설치 방법

### 1단계: CloudConvert API 키 발급

1. [cloudconvert.com](https://cloudconvert.com) 에서 무료 계정 생성
2. **Dashboard → API Keys → Create API Key** 클릭
3. 생성된 API 키 복사 (무료 계정: 하루 25회 변환 제공)

### 2단계: API 키 설정

`config.php` 파일을 열고 아래 부분을 수정하세요:

```php
define('CLOUDCONVERT_API_KEY', 'YOUR_CLOUDCONVERT_API_KEY_HERE');
// 👆 이 부분을 발급받은 실제 API 키로 교체
```

### 3단계: CAFE24에 파일 업로드

CAFE24 FTP 또는 호스팅 관리자를 통해 모든 파일을 웹 루트(`www/` 또는 `public_html/`)에 업로드합니다.

```
업로드할 파일 목록:
├── index.html
├── convert.php
├── config.php
├── .htaccess
├── uploads/          (빈 폴더, 777 권한 필요)
│   └── .htaccess
├── converted/         (빈 폴더, 777 권한 필요)
└── assets/
    ├── css/
    │   └── style.css
    └── js/
        └── app.js
```

### 4단계: 폴더 권한 설정

CAFE24 파일 관리자에서 `uploads/` 폴더의 권한을 **755** 또는 **777**로 설정하세요.

---

## CAFE24 PHP 설정

CAFE24 호스팅 관리자에서 PHP 버전 **7.4 이상**을 선택하고, 아래 설정을 확인하세요:

| 설정 항목 | 권장값 |
|-----------|--------|
| upload_max_filesize | 50M |
| post_max_size | 55M |
| max_execution_time | 300 |
| memory_limit | 256M |

> `.htaccess` 파일에서 자동으로 설정을 시도하지만, CAFE24 호스팅 정책에 따라 별도로 설정이 필요할 수 있습니다.

---

## 지원 파일 형식

| 형식 | 확장자 | 비고 |
|------|--------|------|
| Microsoft Word | .doc, .docx | - |
| 한글(HWP) | .hwp, .hwpx | CloudConvert가 LibreOffice로 처리 |
| PowerPoint | .ppt, .pptx | - |

---

## 변환 요금 (CloudConvert)

| 플랜 | 비용 | 변환 횟수 |
|------|------|----------|
| 무료 | 무료 | 하루 25회 |
| Pay-as-you-go | ~$0.01/회 | 무제한 |
| 월정액 | $13~/월 | 1,000회/월~ |

---

## 보안 사항

- 업로드된 파일은 CloudConvert 서버에서 변환 후 자동 삭제됩니다
- `config.php`는 `.htaccess`로 외부 직접 접근이 차단됩니다
- `uploads/` 폴더는 PHP 실행이 차단됩니다
- HTTPS 사용을 강력히 권장합니다 (CAFE24 무료 SSL 제공)

---

## 문제 해결

**"API 키가 설정되지 않았습니다" 오류**
→ `config.php`에서 API 키를 올바르게 설정했는지 확인

**"cURL 오류" 발생**
→ CAFE24 호스팅에서 외부 HTTPS 연결이 허용되어 있는지 확인 (일반적으로 허용됨)

**파일 업로드가 안 될 때**
→ `uploads/` 폴더 권한이 755 이상인지 확인
→ CAFE24 PHP 설정에서 `upload_max_filesize` 확인

**HWP 파일 변환 실패**
→ CloudConvert의 HWP 지원은 LibreOffice 기반이며, 복잡한 HWP 문서는 레이아웃이 달라질 수 있습니다
