import { esc } from '../../core/md.js';

export function loginView(repo, error = '') {
  return `<div class="main"><section class="card login">
  <h1>🐕 Чейз</h1>
  <p>Вставь ключ доступа GitHub к репозиторию с данными. Это нужно один раз на каждом устройстве.</p>
  ${error ? `<p class="warn">${esc(error)}</p>` : ''}
  <form class="stack">
    <label>Репозиторий с данными<input name="repo" required value="${esc(repo)}" autocapitalize="off"></label>
    <label>Ключ (fine-grained token)<input name="token" type="password" required autocomplete="off" placeholder="github_pat_…"></label>
    <button class="btn primary big">Войти</button>
  </form>
  <details class="hint"><summary>Где взять ключ?</summary><ol>
    <li>Открой <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Settings → Fine-grained tokens → Generate new token</a>.</li>
    <li>Token name: «Чейз — телефон». Expiration: 1 год.</li>
    <li>Repository access: <b>Only select repositories</b> → <b>chase-data</b>.</li>
    <li>Permissions → Repository permissions → <b>Contents: Read and write</b>.</li>
    <li>Generate token → скопируй и вставь сюда.</li>
  </ol></details>
</section></div>`;
}
