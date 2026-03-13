#!/usr/bin/env node
/**
 * Post Tool Use Tracker Hook
 *
 * 이 훅은 Edit/Write 도구 사용 후 실행되어
 * 변경된 파일을 추적하고 필요시 검증을 트리거합니다.
 *
 * 입력: stdin으로 JSON 형식의 도구 사용 데이터
 * 출력: 추적 정보 및 검증 필요 여부
 */

const fs = require('fs');
const path = require('path');

// 추적 로그 파일 경로
const TRACKING_DIR = path.join(__dirname, '..', '..', 'dev', 'active');
const TRACKING_FILE = path.join(TRACKING_DIR, 'file-changes.log');

/**
 * 추적 디렉토리 확인/생성
 */
function ensureTrackingDir() {
  if (!fs.existsSync(TRACKING_DIR)) {
    fs.mkdirSync(TRACKING_DIR, { recursive: true });
  }
}

/**
 * 파일 변경 기록
 */
function logFileChange(filePath, toolName, timestamp) {
  ensureTrackingDir();

  const entry = {
    timestamp,
    tool: toolName,
    file: filePath,
    requiresAudit: shouldRequireAudit(filePath)
  };

  const logLine = JSON.stringify(entry) + '\n';
  fs.appendFileSync(TRACKING_FILE, logLine);

  return entry;
}

/**
 * 멀티테넌트 감사 필요 여부 결정
 */
function shouldRequireAudit(filePath) {
  const auditPatterns = [
    /app\/api\/.+\.ts$/,
    /lib\/services\/.+\.ts$/,
    /lib\/session\.ts$/,
    /lib\/permissions\.ts$/,
    /lib\/auth\.ts$/
  ];

  return auditPatterns.some(pattern => pattern.test(filePath.replace(/\\/g, '/')));
}

/**
 * 보안 관련 파일 여부 확인
 */
function isSecuritySensitive(filePath) {
  const securityPatterns = [
    /lib\/auth\.ts$/,
    /middleware\.ts$/,
    /lib\/session\.ts$/,
    /lib\/permissions\.ts$/
  ];

  return securityPatterns.some(pattern => pattern.test(filePath.replace(/\\/g, '/')));
}

/**
 * 변경 통계 가져오기 (최근 세션만, 로그 크기 제한)
 */
function getChangeStats() {
  if (!fs.existsSync(TRACKING_FILE)) {
    return { total: 0, requiresAudit: 0, securitySensitive: 0 };
  }

  const content = fs.readFileSync(TRACKING_FILE, 'utf-8');
  let lines = content.trim().split('\n').filter(Boolean);

  // 로그 파일 크기 제한: 최근 1000개 항목만 유지
  const MAX_LOG_ENTRIES = 1000;
  if (lines.length > MAX_LOG_ENTRIES) {
    lines = lines.slice(-MAX_LOG_ENTRIES);
    // 잘린 로그 파일 다시 쓰기
    fs.writeFileSync(TRACKING_FILE, lines.join('\n') + '\n');
  }

  let requiresAudit = 0;
  let securitySensitive = 0;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.requiresAudit) requiresAudit++;
      if (isSecuritySensitive(entry.file)) securitySensitive++;
    } catch {
      // 파싱 실패한 라인 무시
    }
  }

  return {
    total: lines.length,
    requiresAudit,
    securitySensitive
  };
}

/**
 * 메인 실행
 */
async function main() {
  let input = '';

  // stdin에서 입력 읽기
  process.stdin.setEncoding('utf-8');

  for await (const chunk of process.stdin) {
    input += chunk;
  }

  try {
    const data = JSON.parse(input);

    // Claude Code PostToolUse 입력 스키마 호환 (다양한 필드명 지원)
    const toolName = data.tool_name || data.toolName || data.tool || '';
    const toolInput = data.tool_input || data.toolInput || data.input || {};

    // Edit 또는 Write 도구인 경우에만 처리
    if (!['Edit', 'Write'].includes(toolName)) {
      console.log(JSON.stringify({ tracked: false, reason: 'Not a file modification tool' }));
      return;
    }

    const filePath = toolInput?.file_path || toolInput?.filePath || toolInput?.path || 'unknown';
    const timestamp = new Date().toISOString();

    // 파일 변경 기록
    const entry = logFileChange(filePath, toolName, timestamp);

    // 통계 업데이트
    const stats = getChangeStats();

    // 결과 출력
    const result = {
      tracked: true,
      entry,
      stats,
      recommendations: []
    };

    // 권장사항 추가
    if (entry.requiresAudit) {
      result.recommendations.push('멀티테넌트 감사(multitenant-auditor) 실행 권장');
    }

    if (isSecuritySensitive(filePath)) {
      result.recommendations.push('보안 검토 필수: ' + filePath);
    }

    if (stats.requiresAudit >= 5) {
      result.recommendations.push('다수의 API 파일 변경됨. 전체 감사 권장.');
    }

    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Hook error:', error.message);
    console.log(JSON.stringify({ error: error.message, tracked: false }));
  }
}

main();
