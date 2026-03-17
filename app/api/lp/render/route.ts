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

  // HTML 파일 읽기 (Supabase Storage 우선, public/landing/ fallback)
  let htmlContent: string | null = null

  // 1. Supabase Storage에서 시도
  const { data: storageData } = await supabase.storage
    .from('landing-pages')
    .download(landingPage.file_name)
  if (storageData) {
    htmlContent = await storageData.text()
  }

  // 2. fallback: public/landing/ 로컬 파일
  if (!htmlContent) {
    const htmlPath = path.join(process.cwd(), 'public', 'landing', landingPage.file_name)
    if (fs.existsSync(htmlPath)) {
      htmlContent = fs.readFileSync(htmlPath, 'utf-8')
    }
  }

  if (!htmlContent) {
    return new NextResponse('HTML 파일을 찾을 수 없습니다.', { status: 404 })
  }

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

  // GTM 이벤트 트래킹: fetch를 래핑하여 리드 제출 성공 시 dataLayer.push 자동 실행
  const gtmEventScript = `
<script>
(function(){
  window.dataLayer = window.dataLayer || [];
  var _origFetch = window.fetch;
  window.fetch = function(url, opts) {
    return _origFetch.apply(this, arguments).then(function(res) {
      if (typeof url === 'string' && url.indexOf('/api/webhook/lead') !== -1 && opts && opts.method === 'POST' && res.ok) {
        var lpData = window.__LP_DATA__ || {};
        window.dataLayer.push({
          event: 'form_submit',
          landing_page_id: lpData.landingPageId || null,
          clinic_id: lpData.clinicId || null,
          clinic_name: lpData.clinicName || ''
        });
      }
      return res;
    });
  };
})();
</script>`

  // GTM 태그 주입 (랜딩페이지별 또는 기본 GTM ID)
  const DEFAULT_GTM_ID = 'GTM-5B2QSHGG'
  const gtmId = landingPage.gtm_id || DEFAULT_GTM_ID
  const gtmHeadScript = `
<!-- Google Tag Manager (auto-injected) -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');</script>
<!-- End Google Tag Manager -->`

  const gtmBodyScript = `
<!-- Google Tag Manager (noscript, auto-injected) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`

  // 기존 GTM 태그가 HTML에 있으면 제거 (중복 방지)
  htmlContent = htmlContent.replace(/<!-- Google Tag Manager -->[\s\S]*?<!-- End Google Tag Manager -->/g, '')
  htmlContent = htmlContent.replace(/<!-- Google Tag Manager \(noscript\) -->[\s\S]*?<!-- End Google Tag Manager \(noscript\) -->/g, '')
  // auto-injected 주석 버전도 제거 (재렌더링 시)
  htmlContent = htmlContent.replace(/<!-- Google Tag Manager \(auto-injected\) -->[\s\S]*?<!-- End Google Tag Manager -->/g, '')
  htmlContent = htmlContent.replace(/<!-- Google Tag Manager \(noscript, auto-injected\) -->[\s\S]*?<!-- End Google Tag Manager \(noscript\) -->/g, '')

  htmlContent = htmlContent.replace('</head>', `${gtmHeadScript}${dataScript}${gtmEventScript}${leadQueueScript}</head>`)
  htmlContent = htmlContent.replace(/<body([^>]*)>/, `<body$1>${gtmBodyScript}`)

  return new NextResponse(htmlContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}

export const dynamic = 'force-dynamic'
