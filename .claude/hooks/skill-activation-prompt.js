#!/usr/bin/env node
/**
 * Skill Activation Prompt Hook
 *
 * 이 훅은 UserPromptSubmit 이벤트에서 실행되어
 * 사용자 프롬프트를 분석하고 관련 스킬을 활성화합니다.
 *
 * 입력: stdin으로 JSON 형식의 프롬프트 데이터
 * 출력: stdout으로 활성화할 스킬 정보
 */

const fs = require('fs');
const path = require('path');

// skill-rules.json 경로
const RULES_PATH = path.join(__dirname, '..', 'skills', 'skill-rules.json');

/**
 * 스킬 규칙 로드
 */
function loadSkillRules() {
  try {
    const content = fs.readFileSync(RULES_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load skill rules:', error.message);
    return { skills: [] };
  }
}

/**
 * 프롬프트에서 키워드 매칭 (단어 경계 고려)
 */
function matchKeywords(prompt, keywords) {
  const lowerPrompt = prompt.toLowerCase();
  return keywords.some(keyword => {
    const lowerKeyword = keyword.toLowerCase();
    // 단어 경계를 고려한 매칭 (한글은 includes, 영문은 word boundary)
    if (/^[a-zA-Z]+$/.test(keyword)) {
      // 영문 키워드: 단어 경계 체크
      const regex = new RegExp(`\\b${lowerKeyword}\\b`, 'i');
      return regex.test(lowerPrompt);
    }
    // 한글 또는 혼합: 단순 포함 체크
    return lowerPrompt.includes(lowerKeyword);
  });
}

/**
 * 활성화할 스킬 결정
 */
function determineActiveSkills(prompt, rules) {
  const activeSkills = [];

  for (const skill of rules.skills) {
    const { triggers, enforcement, name, description } = skill;

    if (triggers?.keywords) {
      if (matchKeywords(prompt, triggers.keywords)) {
        activeSkills.push({
          name,
          enforcement,
          description,
          reason: 'keyword_match'
        });
      }
    }
  }

  return activeSkills;
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

    // Claude Code 훅 입력 스키마 호환 (다양한 필드명 지원)
    const prompt = data.user_input || data.prompt || data.message || data.content || '';

    if (!prompt) {
      console.log(JSON.stringify({ skills: [], message: 'No prompt provided' }));
      return;
    }

    const rules = loadSkillRules();
    const activeSkills = determineActiveSkills(prompt, rules);

    // 결과 출력
    const result = {
      skills: activeSkills,
      blockingSkills: activeSkills.filter(s => s.enforcement === 'block'),
      suggestedSkills: activeSkills.filter(s => s.enforcement === 'suggest')
    };

    // block 모드 스킬이 있으면 경고 메시지 추가
    if (result.blockingSkills.length > 0) {
      result.warning = `CRITICAL: 다음 스킬의 가이드라인을 반드시 준수하세요: ${
        result.blockingSkills.map(s => s.name).join(', ')
      }`;
    }

    // 활성화된 스킬의 파일 경로 추가 (Claude가 참조할 수 있도록)
    result.skillFiles = activeSkills.map(s => ({
      name: s.name,
      path: path.join(__dirname, '..', 'skills', `${s.name}.md`)
    }));

    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Hook error:', error.message);
    console.log(JSON.stringify({ error: error.message, skills: [] }));
  }
}

main();
