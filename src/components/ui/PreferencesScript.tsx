/**
 * 테마와 본문 글자 크기는 첫 페인트 전에 적용되어야 한다.
 * 그렇지 않으면 밝은 화면이 한 번 번쩍이는데, 조용한 방이라는 컨셉과 정면으로 충돌한다.
 * 그래서 아주 작은 인라인 스크립트로 <html> 속성을 먼저 세팅한다.
 */
const script = `(function(){try{
var t=localStorage.getItem('golbang.theme');
if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);
var s=localStorage.getItem('golbang.textsize');
if(s==='m'||s==='l')document.documentElement.setAttribute('data-textsize',s);
}catch(e){}})()`

export function PreferencesScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
