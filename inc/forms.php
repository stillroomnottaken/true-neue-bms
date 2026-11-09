<?php
defined('APP_ROOT') or exit;
/**
 * The two enquiry forms (buyer / supplier) in both languages. They are driven by assets/js/main.js (validation, WhatsApp hand-off)
 * so their field names and data-attributes must stay as they are. Headline and hint above the fields come from the page's form
 * section in the editor; the material drop-down and the WhatsApp number are filled in by PHP.
 * Placeholders: {{TITLE}} {{HINT}} {{OPTIONS}} {{WA}}
 */
const FORM_HTML = [
    'buyer-en' => <<<'HTML'
<form id="buyer-form" class="form" novalidate data-kind="buyer" data-mode="whatsapp" data-wa="{{WA}}" data-lang="en">
      {{TITLE}}
      <div class="field">
        <label class="l" for="b-material">Material <span class="req" aria-hidden="true">*</span></label>
        <select id="b-material" name="material" required>
  <option value="">Select a material</option>
{{OPTIONS}}  <option value="other">Other / not listed</option>
</select>

        <p class="err">Please select a material.</p>
      </div>
      <div class="field" data-other hidden>
        <label class="l" for="b-other">Which material?</label>
        <input id="b-other" name="other" type="text" maxlength="80">
      </div>
      <div class="field">
        <label class="l" for="b-qty">Quantity needed <span class="opt">(optional)</span></label>
        <div class="row-q">
          <input id="b-qty" name="qty" type="number" min="0" step="any" inputmode="decimal" placeholder="20">
          <select name="unit" aria-label="Unit"><option value="ton">Tons</option><option value="kg">kg</option><option value="">To be discussed</option></select>
        </div>
      </div>
      <div class="field">
        <label class="l" for="b-location">Delivery location (city / port) <span class="opt">(optional)</span></label>
        <input id="b-location" name="location" type="text" maxlength="80" autocomplete="off">
      </div>
      <div class="field">
        <label class="l" for="b-notes">Specifications or notes <span class="opt">(optional)</span></label>
        <textarea id="b-notes" name="notes" rows="3" maxlength="600" placeholder="e.g. particle size, packing, timing"></textarea>
      </div>
      <div class="row-2">
        <div class="field">
          <label class="l" for="b-name">Your name <span class="req" aria-hidden="true">*</span></label>
          <input id="b-name" name="name" type="text" autocomplete="name" maxlength="80" required>
          <p class="err">Please enter your name.</p>
        </div>
        <div class="field">
          <label class="l" for="b-company">Company <span class="opt">(optional)</span></label>
          <input id="b-company" name="company" type="text" autocomplete="organization" maxlength="80">
        </div>
      </div>
      <p class="hint" style="margin:0 0 8px">How can we reach you? Please give at least one.</p>
      <div class="row-2">
        <div class="field">
          <label class="l" for="b-phone">WhatsApp number</label>
          <input id="b-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="0812 3456 7890">
          <p class="err">Please enter a valid phone number.</p>
        </div>
        <div class="field">
          <label class="l" for="b-email">Email</label>
          <input id="b-email" name="email" type="email" autocomplete="email" maxlength="120">
          <p class="err">Please enter a valid email address.</p>
        </div>
      </div>
      <p class="err" data-contact-err style="margin:-8px 0 12px">Please give a WhatsApp number or an email address.</p>
      <div class="hp" aria-hidden="true"><label>Website <input type="text" name="_gotcha" tabindex="-1" autocomplete="off"></label></div>
      <button class="btn btn-forest" type="submit" data-label="Continue on WhatsApp" data-busy="Sending...">Continue on WhatsApp</button>
      <p class="hint">This opens WhatsApp with your enquiry written out. Just tap send.</p>

      <div class="sent" data-sent role="status" aria-live="polite">
        <p><b>WhatsApp should now be open.</b> Your enquiry is only sent once you tap send there.</p>
        <p><a class="btn btn-gold btn-sm" data-sent-link href="https://wa.me/{{WA}}" target="_blank" rel="noopener">Not opened? Tap here</a></p>
      </div>
      <noscript><p class="hint">This form needs JavaScript. Please use WhatsApp instead: <a href="https://wa.me/{{WA}}">wa.me/{{WA}}</a></p></noscript>
    </form>
HTML,
    'buyer-id' => <<<'HTML'
<form id="buyer-form" class="form" novalidate data-kind="buyer" data-mode="whatsapp" data-wa="{{WA}}" data-lang="id">
      {{TITLE}}
      <div class="field">
        <label class="l" for="b-material">Material <span class="req" aria-hidden="true">*</span></label>
        <select id="b-material" name="material" required>
  <option value="">Pilih material</option>
{{OPTIONS}}  <option value="other">Lainnya / tidak ada di daftar</option>
</select>

        <p class="err">Pilih material.</p>
      </div>
      <div class="field" data-other hidden>
        <label class="l" for="b-other">Material apa?</label>
        <input id="b-other" name="other" type="text" maxlength="80">
      </div>
      <div class="field">
        <label class="l" for="b-qty">Jumlah yang dibutuhkan <span class="opt">(opsional)</span></label>
        <div class="row-q">
          <input id="b-qty" name="qty" type="number" min="0" step="any" inputmode="decimal" placeholder="20">
          <select name="unit" aria-label="Satuan"><option value="ton">Ton</option><option value="kg">kg</option><option value="">Dibahas nanti</option></select>
        </div>
      </div>
      <div class="field">
        <label class="l" for="b-location">Lokasi pengiriman (kota / pelabuhan) <span class="opt">(opsional)</span></label>
        <input id="b-location" name="location" type="text" maxlength="80" autocomplete="off">
      </div>
      <div class="field">
        <label class="l" for="b-notes">Spesifikasi atau catatan <span class="opt">(opsional)</span></label>
        <textarea id="b-notes" name="notes" rows="3" maxlength="600" placeholder="mis. ukuran partikel, kemasan, waktu"></textarea>
      </div>
      <div class="row-2">
        <div class="field">
          <label class="l" for="b-name">Nama Anda <span class="req" aria-hidden="true">*</span></label>
          <input id="b-name" name="name" type="text" autocomplete="name" maxlength="80" required>
          <p class="err">Masukkan nama Anda.</p>
        </div>
        <div class="field">
          <label class="l" for="b-company">Perusahaan <span class="opt">(opsional)</span></label>
          <input id="b-company" name="company" type="text" autocomplete="organization" maxlength="80">
        </div>
      </div>
      <p class="hint" style="margin:0 0 8px">Bagaimana kami menghubungi Anda? Isi minimal satu.</p>
      <div class="row-2">
        <div class="field">
          <label class="l" for="b-phone">Nomor WhatsApp</label>
          <input id="b-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="0812 3456 7890">
          <p class="err">Masukkan nomor telepon yang valid.</p>
        </div>
        <div class="field">
          <label class="l" for="b-email">Email</label>
          <input id="b-email" name="email" type="email" autocomplete="email" maxlength="120">
          <p class="err">Masukkan alamat email yang valid.</p>
        </div>
      </div>
      <p class="err" data-contact-err style="margin:-8px 0 12px">Isi nomor WhatsApp atau alamat email.</p>
      <div class="hp" aria-hidden="true"><label>Website <input type="text" name="_gotcha" tabindex="-1" autocomplete="off"></label></div>
      <button class="btn btn-forest" type="submit" data-label="Lanjutkan di WhatsApp" data-busy="Mengirim...">Lanjutkan di WhatsApp</button>
      <p class="hint">Ini membuka WhatsApp dengan permintaan Anda sudah tertulis. Tinggal tekan kirim.</p>

      <div class="sent" data-sent role="status" aria-live="polite">
        <p><b>WhatsApp seharusnya sudah terbuka.</b> Permintaan Anda baru terkirim setelah Anda menekan kirim di sana.</p>
        <p><a class="btn btn-gold btn-sm" data-sent-link href="https://wa.me/{{WA}}" target="_blank" rel="noopener">Belum terbuka? Tekan di sini</a></p>
      </div>
      <noscript><p class="hint">Formulir ini membutuhkan JavaScript. Silakan gunakan WhatsApp: <a href="https://wa.me/{{WA}}">wa.me/{{WA}}</a></p></noscript>
    </form>
HTML,
    'supplier-en' => <<<'HTML'
<form id="supplier-form" class="form" novalidate data-kind="supplier" data-mode="whatsapp" data-wa="{{WA}}" data-lang="en">
      {{TITLE}}{{HINT}}
      <div class="field">
        <label class="l" for="s-name">Your name or organisation <span class="req" aria-hidden="true">*</span></label>
        <input id="s-name" name="name" type="text" autocomplete="name" maxlength="80" required>
        <p class="err">Please enter your name or organisation.</p>
      </div>
      <div class="field">
        <label class="l" for="s-phone">Your WhatsApp / phone number <span class="req" aria-hidden="true">*</span></label>
        <input id="s-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="0812 3456 7890" required>
        <p class="err">Please enter a valid phone number.</p>
      </div>
      <div class="field">
        <label class="l" for="s-material">Material offered <span class="req" aria-hidden="true">*</span></label>
        <select id="s-material" name="material" required>
  <option value="">Select a material</option>
{{OPTIONS}}  <option value="other">Other / not listed</option>
</select>

        <p class="err">Please select a material.</p>
      </div>
      <div class="field" data-other hidden>
        <label class="l" for="s-other">Which material?</label>
        <input id="s-other" name="other" type="text" maxlength="80">
      </div>
      <div class="field">
        <label class="l" for="s-qty">Approximate quantity available <span class="opt">(optional)</span></label>
        <div class="row-q">
          <input id="s-qty" name="qty" type="number" min="0" step="any" inputmode="decimal" placeholder="20">
          <select name="unit" aria-label="Unit"><option value="ton">Tons</option><option value="kg">kg</option><option value="">To be discussed</option></select>
        </div>
      </div>
      <div class="field">
        <label class="l" for="s-location">Location (city / province) <span class="req" aria-hidden="true">*</span></label>
        <input id="s-location" name="location" type="text" maxlength="80" autocomplete="off" required>
        <p class="err">Please enter where the material is.</p>
      </div>
      <div class="field">
        <label class="l" for="s-notes">Additional notes <span class="opt">(optional)</span></label>
        <textarea id="s-notes" name="notes" rows="3" maxlength="600"></textarea>
      </div>
      <button class="btn btn-gold" type="submit">Continue on WhatsApp</button>
      <div class="sent" data-sent role="status" aria-live="polite">
        <p><b>WhatsApp should now be open.</b> Your enquiry is only sent once you tap send there.</p>
        <p><a class="btn btn-gold btn-sm" data-sent-link href="https://wa.me/{{WA}}" target="_blank" rel="noopener">Not opened? Tap here</a></p>
      </div>
      <noscript><p class="hint">This form needs JavaScript. Please use the WhatsApp button instead.</p></noscript>
    </form>
HTML,
    'supplier-id' => <<<'HTML'
<form id="supplier-form" class="form" novalidate data-kind="supplier" data-mode="whatsapp" data-wa="{{WA}}" data-lang="id">
      {{TITLE}}{{HINT}}
      <div class="field">
        <label class="l" for="s-name">Nama Anda atau organisasi <span class="req" aria-hidden="true">*</span></label>
        <input id="s-name" name="name" type="text" autocomplete="name" maxlength="80" required>
        <p class="err">Masukkan nama atau organisasi Anda.</p>
      </div>
      <div class="field">
        <label class="l" for="s-phone">Nomor WhatsApp / telepon Anda <span class="req" aria-hidden="true">*</span></label>
        <input id="s-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="0812 3456 7890" required>
        <p class="err">Masukkan nomor telepon yang valid.</p>
      </div>
      <div class="field">
        <label class="l" for="s-material">Material yang ditawarkan <span class="req" aria-hidden="true">*</span></label>
        <select id="s-material" name="material" required>
  <option value="">Pilih material</option>
{{OPTIONS}}  <option value="other">Lainnya / tidak ada di daftar</option>
</select>

        <p class="err">Pilih material.</p>
      </div>
      <div class="field" data-other hidden>
        <label class="l" for="s-other">Material apa?</label>
        <input id="s-other" name="other" type="text" maxlength="80">
      </div>
      <div class="field">
        <label class="l" for="s-qty">Perkiraan jumlah tersedia <span class="opt">(opsional)</span></label>
        <div class="row-q">
          <input id="s-qty" name="qty" type="number" min="0" step="any" inputmode="decimal" placeholder="20">
          <select name="unit" aria-label="Satuan"><option value="ton">Ton</option><option value="kg">kg</option><option value="">Dibahas nanti</option></select>
        </div>
      </div>
      <div class="field">
        <label class="l" for="s-location">Lokasi (kota / provinsi) <span class="req" aria-hidden="true">*</span></label>
        <input id="s-location" name="location" type="text" maxlength="80" autocomplete="off" required>
        <p class="err">Masukkan lokasi material.</p>
      </div>
      <div class="field">
        <label class="l" for="s-notes">Catatan tambahan <span class="opt">(opsional)</span></label>
        <textarea id="s-notes" name="notes" rows="3" maxlength="600"></textarea>
      </div>
      <button class="btn btn-gold" type="submit">Lanjutkan di WhatsApp</button>
      <div class="sent" data-sent role="status" aria-live="polite">
        <p><b>WhatsApp seharusnya sudah terbuka.</b> Pesan Anda baru terkirim setelah Anda menekan kirim di sana.</p>
        <p><a class="btn btn-gold btn-sm" data-sent-link href="https://wa.me/{{WA}}" target="_blank" rel="noopener">Belum terbuka? Tekan di sini</a></p>
      </div>
      <noscript><p class="hint">Formulir ini membutuhkan JavaScript. Silakan gunakan tombol WhatsApp.</p></noscript>
    </form>
HTML,
];
