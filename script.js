/* ============================================================
   ABSENCE FORM — script.js (v2)
   Updated: hardcoded sites, class dropdown, updated validation
   ============================================================ */

var staffData = [];

/* ── On load: fetch staff names only ───────────────────────── */

window.addEventListener('DOMContentLoaded', function () {
  var nameSelect = document.getElementById('nameSelect');

  fetch('/getStaff')
    .then(function (res) {
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    })
    .then(function (data) {
      staffData = data;
      nameSelect.innerHTML = '<option value="">Select Name</option>';
      data.forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name;
        nameSelect.appendChild(opt);
      });
    })
    .catch(function (err) {
      nameSelect.innerHTML = '<option value="">Failed to load — refresh</option>';
      console.error('Staff fetch error:', err);
    });
});

/* ── Class dropdown (updates based on site selected) ──────── */

function updateClassOptions() {
  var site = document.getElementById('siteSelect').value;
  var classDiv = document.getElementById('classDiv');
  var classSelect = document.getElementById('classSelect');

  classSelect.innerHTML = '<option value="">Select Class</option>';

  var options = [];
  if (site === 'Brunton Place') {
    options = ['Red', 'Green', 'Blue', 'Yellow', 'Purple', 'Orange', 'Pink'];
  } else if (site === 'St Judes') {
    options = ['Pink', 'Blue', 'Red', 'Orange', 'Yellow', 'Green'];
  }

  if (options.length > 0) {
    options.forEach(function (opt) {
      classSelect.add(new Option(opt, opt));
    });
    classDiv.style.display = 'block';
    classSelect.required = true;
  } else {
    classDiv.style.display = 'none';
    classSelect.required = false;
  }
}

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
  document.getElementById('coverModule').style.display =
    document.getElementById('coverStatus').value === 'arranged' ? 'block' : 'none';
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
  var s = document.getElementById('start');
  var e = document.getElementById('end');
  if (s.value) { e.value = s.value; e.min = s.value; }
  validateDates();
}

function validateDates() {
  var s = document.getElementById('start');
  var e = document.getElementById('end');
  e.setCustomValidity(
    (s.value && e.value && e.value < s.value) ? 'Last day cannot be before First day' : ''
  );
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
  changeStep(document.getElementById('absType').value === 'Sickness' ? 'step2-sickness' : 'step2-leave');
}

/* ── Step validation ────────────────────────────────────── */

function validateStep(s) {
  var type = document.getElementById('absType').value;

  if (s === 1) {
    var n  = document.getElementById('nameSelect');
    var si = document.getElementById('siteSelect');
    var cs = document.getElementById('classSelect');
    var at = document.getElementById('absType');
    if (!n.reportValidity() || !si.reportValidity() || !cs.reportValidity() || !at.reportValidity()) return;
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
    // More information is ALWAYS required (not just for "other")
    if (!lot.value) { lot.setCustomValidity('More information is required'); lot.reportValidity(); return; } else { lot.setCustomValidity(''); }

    var conf = document.querySelector('#step2-leave input[type="checkbox"]');
    if (!conf.checked) { conf.setCustomValidity('Please confirm selection'); conf.reportValidity(); return; } else { conf.setCustomValidity(''); }

    if (document.getElementById('coverStatus').value === 'arranged') {
      var selectedDuties = document.querySelectorAll('.duty-chip.selected');
      var anchor = document.getElementById('dutyValidationAnchor');
      if (selectedDuties.length === 0) {
        anchor.setCustomValidity('Please select at least one duty needing cover.');
        anchor.reportValidity();
        return;
      } else { anchor.setCustomValidity(''); }

      var otherChip = Array.from(selectedDuties).find(function (chip) { return chip.textContent.includes('Other:'); });
      var otherDutyText = document.getElementById('otherDutyText');
      if (otherChip && !otherDutyText.value) {
        otherDutyText.setCustomValidity('Please specify the other duty.');
        otherDutyText.reportValidity();
        return;
      } else { otherDutyText.setCustomValidity(''); }

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
    if (!tOut.value) { tOut.setCustomValidity('Required'); tOut.reportValidity(); return; } else { tOut.setCustomValidity(''); }
    if (!tRet.value) { tRet.setCustomValidity('Required'); tRet.reportValidity(); return; } else { tRet.setCustomValidity(''); }
  }

  var dutiesArr = Array.from(document.querySelectorAll('.duty-chip.selected'))
    .map(function (el) { return el.textContent.replace(':', '').trim(); });

  var otherDutyEl = document.getElementById('otherDutyText');
  if (otherDutyEl.value && otherDutyEl.style.display !== 'none') dutiesArr.push(otherDutyEl.value);

  var leaveReasonEl  = document.getElementById('leaveReason');
  var otherLeaveText = document.getElementById('otherLeaveText');
  var leaveReasonVal = leaveReasonEl.value
    ? (leaveReasonEl.value + ': ' + otherLeaveText.value)
    : '';

  var sickReasonEl  = document.getElementById('sickReason');
  var sickReasonVal = sickReasonEl.value === 'other'
    ? document.getElementById('otherSickText').value
    : sickReasonEl.value;

  var payload = {
    name:        document.getElementById('nameSelect').value,
    site:        document.getElementById('siteSelect').value,
    staffClass:  document.getElementById('classSelect').value,
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
