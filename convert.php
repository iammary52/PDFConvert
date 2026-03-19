<?php
/**
 * PDF 변환기 - 백엔드 처리 (CloudConvert API v2)
 * CAFE24 PHP 호스팅 환경 호환
 */

require_once __DIR__ . '/config.php';

// ======================================
// CORS & 보안 헤더
// ======================================
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');

// CORS 처리
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (empty(ALLOWED_ORIGINS) || in_array($origin, ALLOWED_ORIGINS)) {
    if (!empty($origin)) {
        header('Access-Control-Allow-Origin: ' . $origin);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    exit(0);
}

// ======================================
// API 키 확인
// ======================================
if (CLOUDCONVERT_API_KEY === 'YOUR_CLOUDCONVERT_API_KEY_HERE' || empty(CLOUDCONVERT_API_KEY)) {
    jsonError('API 키가 설정되지 않았습니다. config.php에서 CloudConvert API 키를 설정해주세요.', 503);
}

// ======================================
// GET: 작업 상태 확인 (폴링)
// ======================================
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $jobId = trim($_GET['job_id'] ?? '');
    if (empty($jobId) || !preg_match('/^[a-zA-Z0-9\-]+$/', $jobId)) {
        jsonError('잘못된 작업 ID입니다.', 400);
    }
    checkJobStatus($jobId);
    exit;
}

// ======================================
// POST: 파일 업로드 및 변환 시작
// ======================================
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('허용되지 않는 요청 방식입니다.', 405);
}

// 파일 확인
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    $uploadErrors = [
        UPLOAD_ERR_INI_SIZE   => '파일이 너무 큽니다 (서버 설정 초과).',
        UPLOAD_ERR_FORM_SIZE  => '파일이 너무 큽니다.',
        UPLOAD_ERR_PARTIAL    => '파일이 부분적으로만 업로드되었습니다.',
        UPLOAD_ERR_NO_FILE    => '파일이 선택되지 않았습니다.',
        UPLOAD_ERR_NO_TMP_DIR => '임시 폴더를 찾을 수 없습니다.',
        UPLOAD_ERR_CANT_WRITE => '파일 저장에 실패했습니다.',
    ];
    $errCode = $_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE;
    jsonError($uploadErrors[$errCode] ?? '파일 업로드 오류가 발생했습니다.', 400);
}

$file = $_FILES['file'];

// 파일 크기 확인
if ($file['size'] > MAX_FILE_SIZE) {
    jsonError('파일 크기가 50MB를 초과합니다.', 400);
}
if ($file['size'] === 0) {
    jsonError('빈 파일은 변환할 수 없습니다.', 400);
}

// 확장자 확인
$originalName = basename($file['name']);
$ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
if (!in_array($ext, ALLOWED_EXTENSIONS)) {
    jsonError('지원하지 않는 파일 형식입니다. (지원: ' . implode(', ', ALLOWED_EXTENSIONS) . ')', 400);
}

// MIME 타입 2차 검증
$allowedMimes = [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/haansofthwp',
    'application/x-hwp',
    'application/vnd.hancom.hwp',
    'application/vnd.hancom.hwpx',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/octet-stream', // 일부 시스템에서 generic mime 사용
    'application/zip', // .docx, .pptx, .hwpx 는 zip 기반
];

// 변환 시작
$jobId = startConversion($file['tmp_name'], $originalName, $ext);
jsonSuccess(['job_id' => $jobId, 'message' => '변환이 시작되었습니다.']);

// ======================================
// Functions
// ======================================

function startConversion($tmpPath, $fileName, $ext) {
    $apiKey = CLOUDCONVERT_API_KEY;
    $baseUrl = CLOUDCONVERT_SANDBOX
        ? 'https://api.sandbox.cloudconvert.com/v2'
        : 'https://api.cloudconvert.com/v2';

    // 입력 포맷 매핑 (HWP는 libreoffice로 변환)
    $inputFormat = $ext;
    $converterOptions = [];

    if (in_array($ext, ['hwp', 'hwpx'])) {
        $converterOptions['input_format'] = $ext;
        $converterOptions['output_format'] = 'pdf';
        $converterOptions['engine'] = 'libreoffice';
    }

    // Job 생성
    $jobData = [
        'tasks' => [
            'upload-task' => [
                'operation' => 'import/upload'
            ],
            'convert-task' => [
                'operation' => 'convert',
                'input'     => ['upload-task'],
                'output_format' => 'pdf',
            ],
            'export-task' => [
                'operation' => 'export/url',
                'input'     => ['convert-task'],
                'inline'    => false,
                'archive_multiple_files' => false
            ]
        ]
    ];

    // HWP 변환 엔진 명시
    if (!empty($converterOptions)) {
        $jobData['tasks']['convert-task'] = array_merge(
            $jobData['tasks']['convert-task'],
            $converterOptions
        );
    }

    $response = apiRequest($baseUrl . '/jobs', 'POST', $jobData, $apiKey);

    if (empty($response['data']['id'])) {
        $msg = $response['message'] ?? ($response['error'] ?? 'API 연결에 실패했습니다.');
        throw new RuntimeException('작업 생성 실패: ' . $msg);
    }

    $jobId  = $response['data']['id'];
    $tasks  = $response['data']['tasks'];

    // 업로드 태스크 찾기
    $uploadTask = null;
    foreach ($tasks as $task) {
        if ($task['name'] === 'upload-task') {
            $uploadTask = $task;
            break;
        }
    }

    if (!$uploadTask || empty($uploadTask['result']['form'])) {
        throw new RuntimeException('업로드 URL을 가져오지 못했습니다.');
    }

    // 파일 업로드 (multipart form)
    $uploadUrl    = $uploadTask['result']['form']['url'];
    $uploadParams = $uploadTask['result']['form']['parameters'];

    $postFields = [];
    foreach ($uploadParams as $key => $val) {
        $postFields[$key] = $val;
    }
    $postFields['file'] = new CURLFile($tmpPath, getMime($tmpPath), $fileName);

    $uploadCh = curl_init();
    curl_setopt_array($uploadCh, [
        CURLOPT_URL            => $uploadUrl,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $postFields,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 120,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);

    $uploadResult = curl_exec($uploadCh);
    $uploadStatus = curl_getinfo($uploadCh, CURLINFO_HTTP_CODE);
    $curlError    = curl_error($uploadCh);
    curl_close($uploadCh);

    if ($curlError) {
        throw new RuntimeException('파일 업로드 네트워크 오류: ' . $curlError);
    }

    // S3 업로드는 204 No Content 반환
    if ($uploadStatus >= 400) {
        throw new RuntimeException('파일 업로드에 실패했습니다. (HTTP ' . $uploadStatus . ')');
    }

    return $jobId;
}

function checkJobStatus($jobId) {
    $apiKey  = CLOUDCONVERT_API_KEY;
    $baseUrl = CLOUDCONVERT_SANDBOX
        ? 'https://api.sandbox.cloudconvert.com/v2'
        : 'https://api.cloudconvert.com/v2';

    $response = apiRequest($baseUrl . '/jobs/' . $jobId, 'GET', null, $apiKey);

    if (empty($response['data'])) {
        jsonError('작업 정보를 가져오지 못했습니다.', 500);
    }

    $job    = $response['data'];
    $status = $job['status'];

    if ($status === 'finished') {
        // export-task에서 다운로드 URL 찾기
        $downloadUrl = null;
        foreach ($job['tasks'] as $task) {
            if ($task['name'] === 'export-task'
                && !empty($task['result']['files'][0]['url'])) {
                $downloadUrl = $task['result']['files'][0]['url'];
                break;
            }
        }

        if (!$downloadUrl) {
            jsonError('PDF 다운로드 URL을 찾을 수 없습니다.', 500);
        }

        jsonSuccess([
            'status'       => 'finished',
            'download_url' => $downloadUrl
        ]);
    }

    if ($status === 'error') {
        // 에러 원인 수집
        $errorMsg = '변환 중 오류가 발생했습니다.';
        foreach ($job['tasks'] as $task) {
            if ($task['status'] === 'error' && !empty($task['message'])) {
                $errorMsg = $task['message'];
                break;
            }
        }
        jsonError($errorMsg, 422);
    }

    // waiting / processing
    jsonSuccess(['status' => $status]);
}

function apiRequest($url, $method, $data, $apiKey) {
    $ch = curl_init();
    $headers = [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json',
        'Accept: application/json',
    ];

    $options = [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => true,
    ];

    if ($method === 'POST') {
        $options[CURLOPT_POST]       = true;
        $options[CURLOPT_POSTFIELDS] = json_encode($data);
    }

    curl_setopt_array($ch, $options);
    $body      = curl_exec($ch);
    $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        throw new RuntimeException('API 네트워크 오류: ' . $curlError);
    }

    $decoded = json_decode($body, true);
    if ($decoded === null) {
        throw new RuntimeException('API 응답 파싱 오류 (HTTP ' . $httpCode . ')');
    }

    return $decoded;
}

function getMime($path) {
    if (function_exists('mime_content_type')) {
        $mime = mime_content_type($path);
        if ($mime && $mime !== 'application/octet-stream') {
            return $mime;
        }
    }
    return 'application/octet-stream';
}

function jsonSuccess($data) {
    echo json_encode(array_merge(['success' => true], $data), JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError($message, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

// Global exception handler
set_exception_handler(function(Throwable $e) {
    jsonError($e->getMessage(), 500);
});
