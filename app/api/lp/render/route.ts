import { NextRequest, NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import fs from 'fs'
import path from 'path'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lpId = searchParams.get('id')

  if (!lpId) {
    return new NextResponse('랜딩 페이지 ID가 필요합니다.', { status: 400 })
  }

  const supabase = serverSupabase()
  const { data: landingPage } = await supabase
    .from('landing_pages')
    .select('*, clinic:clinics(id, name)')
    .eq('id', lpId)
    .eq('is_active', true)
    .single()

  if (!landingPage) {
    return new NextResponse('랜딩 페이지를 찾을 수 없습니다.', { status: 404 })
  }

  // HTML 파일 읽기
  const htmlPath = path.join(process.cwd(), 'public', 'landing', landingPage.file_name)

  if (!fs.existsSync(htmlPath)) {
    return new NextResponse('HTML 파일을 찾을 수 없습니다.', { status: 404 })
  }

  let htmlContent = fs.readFileSync(htmlPath, 'utf-8')

  // 데이터 주입 (</head> 앞에 스크립트 삽입)
  const clinicName = landingPage.clinic?.name || ''
  const dataScript = `
<script>
  window.__LP_DATA__ = {
    clinicId: ${landingPage.clinic_id || 'null'},
    landingPageId: ${landingPage.id},
    clinicName: "${clinicName.replace(/"/g, '\\"')}"
  };
</script>`

  // 리드 유실 방지: localStorage 큐 스크립트 주입
  const leadQueueScript = `
<script>
(function(){
  var PREFIX = 'lead_q_';
  window.LeadQueue = {
    generateKey: function() {
      return PREFIX + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    },
    generateIdempotencyKey: function() {
      return Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    },
    save: function(payload) {
      try {
        var key = this.generateKey();
        var saved = Object.assign({}, payload);
        if (!saved.idempotency_key) {
          saved.idempotency_key = this.generateIdempotencyKey();
        }
        payload.idempotency_key = saved.idempotency_key;
        localStorage.setItem(key, JSON.stringify({ payload: saved, timestamp: Date.now() }));
        return key;
      } catch(e) { return null; }
    },
    remove: function(key) {
      try { if (key) localStorage.removeItem(key); } catch(e) {}
    },
    getPending: function() {
      var items = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          if (key && key.indexOf(PREFIX) === 0) {
            var raw = localStorage.getItem(key);
            if (raw) {
              var parsed = JSON.parse(raw);
              items.push({ key: key, payload: parsed.payload, timestamp: parsed.timestamp });
            }
          }
        }
      } catch(e) {}
      return items;
    },
    retry: function() {
      var pending = this.getPending();
      var self = this;
      var i = 0;
      function next() {
        if (i >= pending.length) return;
        var item = pending[i++];
        // 24시간 이상 된 항목은 삭제
        if (Date.now() - item.timestamp > 86400000) {
          self.remove(item.key);
          next();
          return;
        }
        fetch('/api/webhook/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload)
        }).then(function(res) {
          if (res.ok) self.remove(item.key);
        }).catch(function() {}).then(next);
      }
      next();
    }
  };
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() { window.LeadQueue.retry(); }, 2000);
  });
})();
</script>`

  htmlContent = htmlContent.replace('</head>', `${dataScript}${leadQueueScript}</head>`)

  return new NextResponse(htmlContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}

export const dynamic = 'force-dynamic'
