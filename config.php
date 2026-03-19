<?php
/**
 * PDF 변환기 설정 파일
 *
 * CloudConvert API 키 설정:
 * 1. https://cloudconvert.com 에서 계정 생성 (무료: 하루 25회 변환)
 * 2. Dashboard > API Keys > Create API Key
 * 3. 아래 CLOUDCONVERT_API_KEY에 발급받은 키를 입력
 */

// ======================================
// CloudConvert API 설정
// ======================================
define('CLOUDCONVERT_API_KEY', 'YOUR_CLOUDCONVERT_API_KEY_HERE');

// Sandbox 모드 (테스트용, 실제 변환 없음 - 테스트 완료 후 false로 변경)
define('CLOUDCONVERT_SANDBOX', false);

// ======================================
// 파일 업로드 설정
// ======================================
define('MAX_FILE_SIZE', 50 * 1024 * 1024); // 50MB
define('ALLOWED_EXTENSIONS', ['doc', 'docx', 'hwp', 'hwpx', 'ppt', 'pptx']);

// 임시 파일 저장 경로 (uploads/ 폴더, 쓰기 권한 필요)
define('UPLOAD_DIR', __DIR__ . '/uploads/');

// ======================================
// 보안 설정
// ======================================
// 허용할 도메인 (빈 배열이면 모든 도메인 허용, CORS)
define('ALLOWED_ORIGINS', []);

// Rate limiting (분당 최대 요청 수, 0이면 비활성화)
define('RATE_LIMIT_PER_MINUTE', 10);
