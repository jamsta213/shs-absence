/* ============================================================
   ABSENCE FORM — script.js
   Calls Cloudflare Pages Functions at /getStaff and /submitAbsence
   ============================================================ */

var staffData = [];

window.addEventListener('DOMContentLoaded', function () {
  var nameSelect = document.getElementById('nameSelect');
  var siteSelect = document.getElementById('siteSelect');

  fetch('/getStaff')
    .then(function (res) {
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    })
    .then(function (data) {
      staffData = data;
      nameSelect.innerHTML = '<option value="">Select Name</option>';
      siteSelect.innerHTML = '<option value="">Select Site</option>';

      data.forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name;
        nameSelect.appendChild(opt);
      });

      var uniqueSites = [...new Set(data.map(function (p) { return p.site; }).filter(function (s) { return s && s !== ''; }))];
      uniqueSites.sort().forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        siteSelect.appendChild(opt);
      });
    })
    .catch(function (err) {
      nameSelect.innerHTML = '<option value="">Failed to load — refresh</option>';
      console.error('Staff fetch error:', err);
    });
});

/* ── UI helpers ─────────────────────────────────────────── */

function styleCard(cb) {
  cb.parentElement.classList.toggle('selected', cb.checked);
}

function toggleOther(el, id) {
  document.getElementById(id).style.display = (el.value === 'other') ? 'block' : 'none';
}

function showLeaveInfo() {
  var val = document.getElementById('leaveReason').value;
  document.getElementById('leaveInfoBox').style.display = val ? 'block' : 'none';
}

function toggleCoverModule() {
  var isArranged = document.getElementById('coverStatus').value === 'arranged';
  document.getElementById('coverModule').style.display = isArranged ? 'block' : 'none';
}

function toggleDuty(el, isOther) {
  el.classList.toggle('selected');
  document.getElementById('dutyValidationAnchor').setCustomValidity('');
  if (isOther) {
    document.getElementById('otherDutyText').style.display =
      el.classList.contains('selected') ? 'block' : 'none';
  }
}

function toggleHalf() {
  document.getElementById('halfDaySection').style.display =
    document.getElementById('dayType').value === 'half' ? 'block' : 'none';
}

function syncDates() {
  var startInput = document.getElementById('start');
  var endInput   = document.getElementById('end');
  if (startInput.value) {
    endInput.value = startInput.value;
    endInput.min   = startInput.value;
  }
  validateDates();
}

function validateDates() {
  var start = document.getElementById('start');
  var end   = document.getElementById('end');
  if (start.value && end.value && end.value < start.value) {
    end.setCustomValidity('Last day cannot be before First day');
  } else {
    end.setCustomValidity('');
  }
}

/* ── Step navigation ────────────────────────────────────── */

function changeStep(id) {
  document.querySelectorAll('.form-step').forEach(function (s) {
    s.classList.remove('active');
  });
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function goBack() {
  var type = document.getElementById('absType').value;
  changeStep(type === 'Sickness' ? 'step2-sickness' : 'step2-leave');
}

/* ── Step validation ────────────────────────────────────── */

function validateStep(s) {
  var type = document.getElementById('absType').value;

  if (s === 1) {
    var n  = document.getElementById('nameSelect');
    var si = document.getElementById('siteSelect');
    var at = document.getElementById('absType');
    if (!n.reportValidity() || !si.reportValidity() || !at.reportValidity()) return;
    document.getElementById('leaveTitle').textContent = type;
    changeStep(type === 'Sickness' ? 'step2-sickness' : 'step2-leave');
    return;
  }

  if (type === 'Sickness') {
    var r  = document.getElementById('sickReason');
    var ot = document.getElementById('otherSickText');
    if (!r.value) { r.setCustomValidity('Please select a reason'); r.reportValidity(); return; } else { r.setCustomValidity(''); }
    if (r.value === 'other' && !ot.value) { ot.setCustomValidity('Please specify'); ot.reportValidity(); return; } else { ot.setCustomValidity(''); }
    var checks = document.querySelectorAll('#step2-sickness input[type="checkbox"]');
    for (var i = 0; i < checks.length; i++) {
      if (!checks[i].checked) { checks[i].setCustomValidity('Please confirm this statement'); checks[i].reportValidity(); return; }
      else { checks[i].setCustomValidity(''); }
    }
  } else {
    var lr  = document.getElementById('leaveReason');
    var lot = document.getElementById('otherLeaveText');
    if (!lr.value) { lr.setCustomValidity('Please select a reason'); lr.reportValidity(); return; } else { lr.setCustomValidity(''); }
    if (lr.value === 'other' && !lot.value) { lot.setCustomValidity('Please provide details'); lot.reportValidity(); return; } else { lot.setCustomValidity(''); }
    var conf = document.querySelector('#step2-leave input[type="checkbox"]');
    if (!conf.checked) { conf.setCustomValidity('Please confirm selection'); conf.reportValidity(); return; } else { conf.setCustomValidity(''); }
    if (document.getElementById('coverStatus').value === 'arranged') {
      if (document.querySelectorAll('.duty-chip.selected').length === 0) {
        var anchor = document.getElementById('dutyValidationAnchor');
        anchor.setCustomValidity('Please select at least one duty.');
        anchor.reportValidity(); return;
      }
      var wc = document.getElementById('whoCover');
      if (!wc.value) { wc.setCustomValidity('Please specify name'); wc.reportValidity(); return; } else { wc.setCustomValidity(''); }
    }
  }

  changeStep('step3-form');
}

/* ── Form submission ─────────────────────────────────────── */

function submitForm() {
  var start   = document.getElementById('start');
  var end     = document.getElementById('end');
  var dayType = document.getElementById('dayType').value;
  var tOut    = document.getElementById('out');
  var tRet    = document.getElementById('ret');

  validateDates();
  if (!start.reportValidity() || !end.reportValidity()) return;

  if (dayType === 'half') {
    if (!tOut.value) { tOut.setCustomValidity('Time Out is required for half days'); tOut.reportValidity(); return; } else { tOut.setCustomValidity(''); }
    if (!tRet.value) { tRet.setCustomValidity('Time Return is required for half days'); tRet.reportValidity(); return; } else { tRet.setCustomValidity(''); }
  }

  var dutiesArr = Array.from(document.querySelectorAll('.duty-chip.selected'))
    .map(function (el) { return el.textContent.replace(':', '').trim(); });

  var otherDutyEl = document.getElementById('otherDutyText');
  if (otherDutyEl.value && otherDutyEl.style.display !== 'none') dutiesArr.push(otherDutyEl.value);

  var leaveReasonEl  = document.getElementById('leaveReason');
  var otherLeaveText = document.getElementById('otherLeaveText');
  var leaveReasonVal = leaveReasonEl.value
    ? (leaveReasonEl.value + (otherLeaveText.value ? ': ' + otherLeaveText.value : ''))
    : '';

  var sickReasonEl  = document.getElementById('sickReason');
  var sickReasonVal = sickReasonEl.value === 'other'
    ? document.getElementById('otherSickText').value
    : sickReasonEl.value;

  var payload = {
    name:        document.getElementById('nameSelect').value,
    site:        document.getElementById('siteSelect').value,
    absType:     document.getElementById('absType').value,
    sickReason:  sickReasonVal,
    leaveReason: leaveReasonVal,
    coverStatus: document.getElementById('coverStatus').value,
    duties:      dutiesArr.join(', '),
    whoCover:    document.getElementById('whoCover').value,
    start:       start.value,
    end:         end.value,
    dayType:     dayType,
    timeOut:     tOut.value,
    timeReturn:  tRet.value
  };

  var btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  var existing = document.getElementById('submitErrorBanner');
  if (existing) existing.remove();

  fetch('/submitAbsence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(function (res) {
      if (!res.ok) {
        return res.json().then(function (body) {
          throw new Error(body.error || 'Server error ' + res.status);
        });
      }
      return res.json();
    })
    .then(function () {
      changeStep('step-success');
    })
    .catch(function (err) {
      var banner = document.createElement('div');
      banner.id = 'submitErrorBanner';
      banner.className = 'error-banner';
      banner.style.display = 'block';
      banner.textContent = 'Submission failed: ' + err.message + '. Please try again.';
      btn.parentNode.insertBefore(banner, btn);
      btn.disabled = false;
      btn.textContent = 'Submit Request';
      console.error('Submit error:', err);
    });
}
