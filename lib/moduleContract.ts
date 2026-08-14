export type ContractResult = { html: string; conformant: boolean };

const CONTRACT_MARKER = "ksl-module-progress";

const STUB_SCRIPT = `<script>
(function () {
  function safe(fn) { try { return fn(); } catch (e) { /* inert contract */ } }
  function postReady() {
    if (typeof checkState === 'undefined' || typeof scenarioAnswered === 'undefined') return;
    var choices = (typeof scenarioChoice !== 'undefined' && Array.isArray(scenarioChoice)) ? scenarioChoice : [];
    var c = checkState.filter(Boolean).length;
    var s = scenarioAnswered.filter(Boolean).length;
    parent.postMessage({ type: 'ksl-module-progress', checklistDone: c, checklistTotal: checkState.length, scenariosDone: s, scenariosTotal: scenarioAnswered.length }, '*');
    parent.postMessage({ type: 'ksl-module-save', checklist: checkState.slice(), scenarios: choices.slice() }, '*');
  }
  function applyRestore(d) {
    if (typeof checkState === 'undefined') return;
    if (Array.isArray(d.checklist) && d.checklist.length === checkState.length) {
      checkState = d.checklist.map(Boolean);
    }
    if (Array.isArray(d.scenarios) && typeof scenarioAnswered !== 'undefined' && d.scenarios.length === scenarioAnswered.length) {
      scenarioAnswered = d.scenarios.map(Boolean);
      if (typeof scenarioChoice !== 'undefined') {
        scenarioChoice = d.scenarios.map(function (v) {
          return (typeof v === 'number' && v >= 0 && typeof scenarios !== 'undefined' && v < scenarios.length) ? v : null;
        });
      }
    }
    if (typeof renderChecklist === 'function') safe(renderChecklist);
    if (typeof renderScenarios === 'function') safe(renderScenarios);
    if (typeof applyScenarioAnswer === 'function') {
      scenarioAnswered.forEach(function (answered, si) {
        if (answered && Array.isArray(scenarioChoice) && scenarioChoice[si] !== null) {
          safe(function () { applyScenarioAnswer(si, scenarioChoice[si]); });
        }
      });
    }
    postReady();
  }
  function wrap(name) {
    if (typeof window[name] !== 'function') return;
    var orig = window[name];
    window[name] = function () { orig.apply(this, arguments); safe(postReady); };
  }
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.type === 'ksl-module-ping') { safe(postReady); return; }
    if (d.type === 'ksl-module-restore') { safe(function () { applyRestore(d); }); }
  });
  wrap('updateProgress');
  wrap('answerScenario');
  wrap('resetChecklist');
})();
</script>`;

export function ensureModuleContract(html: string): ContractResult {
  if (html.includes(CONTRACT_MARKER)) {
    return { html, conformant: true };
  }

  if (!html.includes("checkState") || !html.includes("scenarioAnswered")) {
    return { html, conformant: false };
  }

  const bodyIndex = html.lastIndexOf("</body>");
  const htmlIndex = html.lastIndexOf("</html>");
  let injected: string;
  if (bodyIndex !== -1) {
    injected = html.slice(0, bodyIndex) + STUB_SCRIPT + html.slice(bodyIndex);
  } else if (htmlIndex !== -1) {
    injected = html.slice(0, htmlIndex) + STUB_SCRIPT + html.slice(htmlIndex);
  } else {
    injected = html + STUB_SCRIPT;
  }

  return { html: injected, conformant: true };
}
