<#
.SYNOPSIS
    Samantha 프로젝트 빌드 검증 훅 (Stop 이벤트)

.DESCRIPTION
    작업 완료 시 빌드 및 린트 검사를 수행합니다.
    에러 발생 시 경고를 출력하고 auto-error-resolver 실행을 권장합니다.

.NOTES
    Claude Code의 Stop 훅으로 실행됩니다.
#>

param()

# 프로젝트 루트로 이동
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

# 결과 객체 (모든 필드 초기화)
$result = @{
    timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
    typescript = @{ success = $false; output = "" }
    build = @{ success = $false; output = "" }
    lint = @{ success = $false; output = "" }
    recommendations = @()
    status = "PENDING"
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Samantha Build Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# TypeScript 타입 체크
Write-Host "[1/3] TypeScript type checking..." -ForegroundColor Yellow
try {
    $tscOutput = & npx tsc --noEmit 2>&1
    $tscExitCode = $LASTEXITCODE

    if ($tscExitCode -eq 0) {
        Write-Host "  ✓ TypeScript: OK" -ForegroundColor Green
        $result.typescript = @{ success = $true; output = "" }
    } else {
        Write-Host "  ✗ TypeScript: FAILED" -ForegroundColor Red
        $result.typescript = @{ success = $false; output = ($tscOutput -join "`n") }
        $result.recommendations += "TypeScript 타입 에러 발견. auto-error-resolver 실행 권장."
    }
} catch {
    Write-Host "  ✗ TypeScript check failed: $($_.Exception.Message)" -ForegroundColor Red
    $result.typescript = @{ success = $false; output = $_.Exception.Message }
}

Write-Host ""

# ESLint 체크
Write-Host "[2/3] ESLint checking..." -ForegroundColor Yellow
try {
    $lintOutput = & npm run lint 2>&1
    $lintExitCode = $LASTEXITCODE

    if ($lintExitCode -eq 0) {
        Write-Host "  ✓ ESLint: OK" -ForegroundColor Green
        $result.lint = @{ success = $true; output = "" }
    } else {
        Write-Host "  ✗ ESLint: FAILED" -ForegroundColor Red
        $result.lint = @{ success = $false; output = ($lintOutput -join "`n") }
        $result.recommendations += "ESLint 에러 발견. 코드 스타일 수정 필요."
    }
} catch {
    Write-Host "  ✗ ESLint check failed: $($_.Exception.Message)" -ForegroundColor Red
    $result.lint = @{ success = $false; output = $_.Exception.Message }
}

Write-Host ""

# Next.js 빌드 테스트 (환경변수로 제어)
Write-Host "[3/3] Next.js build check..." -ForegroundColor Yellow

# 환경변수 SAMANTHA_FULL_BUILD_CHECK=true 설정 시에만 전체 빌드 실행
# 기본값: 스킵 (빌드는 CI/CD에서 수행)
if ($env:SAMANTHA_FULL_BUILD_CHECK -eq "true") {
    try {
        $buildOutput = & npm run build 2>&1
        $buildExitCode = $LASTEXITCODE

        if ($buildExitCode -eq 0) {
            Write-Host "  ✓ Build: OK" -ForegroundColor Green
            $result.build = @{ success = $true; output = "" }
        } else {
            Write-Host "  ✗ Build: FAILED" -ForegroundColor Red
            $result.build = @{ success = $false; output = ($buildOutput -join "`n") }
            $result.recommendations += "빌드 실패. auto-error-resolver 실행 권장."
        }
    } catch {
        Write-Host "  ✗ Build check failed: $($_.Exception.Message)" -ForegroundColor Red
        $result.build = @{ success = $false; output = $_.Exception.Message }
    }
} else {
    Write-Host "  ⊘ Build: SKIPPED (set SAMANTHA_FULL_BUILD_CHECK=true to enable)" -ForegroundColor DarkGray
    $result.build = @{ success = $true; output = "skipped"; skipped = $true }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

# 최종 결과 (스킵된 항목은 통과로 간주)
$typescriptOk = $result.typescript.success
$lintOk = $result.lint.success
$buildOk = $result.build.success -or $result.build.skipped
$allPassed = $typescriptOk -and $lintOk -and $buildOk

if ($allPassed) {
    Write-Host " All checks passed! ✓" -ForegroundColor Green
    $result.status = "PASSED"
} else {
    Write-Host " Some checks failed ✗" -ForegroundColor Red
    $result.status = "FAILED"

    Write-Host ""
    Write-Host "Recommendations:" -ForegroundColor Yellow
    foreach ($rec in $result.recommendations) {
        Write-Host "  - $rec" -ForegroundColor Yellow
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# JSON 결과 출력 (Claude Code에서 파싱 가능)
$jsonResult = $result | ConvertTo-Json -Depth 4 -Compress
Write-Output "BUILD_CHECK_RESULT:$jsonResult"

# 종료 코드 반환
if ($allPassed) {
    exit 0
} else {
    exit 1
}
