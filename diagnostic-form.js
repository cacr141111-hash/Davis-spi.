(() => {
  const form = document.querySelector("#diagnostic-form");
  const status = document.querySelector("#form-status");
  const draftStatus = document.querySelector("#draft-status");
  const clearDraftButton = document.querySelector("#clear-draft");
  const errorDialog = document.querySelector("#submit-error-dialog");
  const closeErrorDialog = document.querySelector("#close-error-dialog");
  const formalGroup = document.querySelector("#formal-status-group");
  const submitButton = form?.querySelector('[type="submit"]');
  const draftKey = "davis-spi-diagnostic-draft-v1";
  const draftLifetimeMs = 24 * 60 * 60 * 1000;
  let draftTimer;

  if (!form || !status || !formalGroup || !submitButton) {
    return;
  }

  const columns = [
    ["submitted_at", "Fecha de envío"],
    ["nombre", "Nombre y apellido"],
    ["correo", "Correo electrónico"],
    ["telefono", "Teléfono / WhatsApp"],
    ["rango_edad", "Rango de edad"],
    ["estado", "Estado"],
    ["municipio", "Ciudad o municipio"],
    ["rol", "Rol"],
    ["etapa", "Situación del negocio"],
    ["empresa", "Nombre comercial o empresa"],
    ["sector", "Actividad o sector principal"],
    ["antiguedad", "Antigüedad del negocio"],
    ["equipo", "Personas en el negocio"],
    ["genera_ingresos", "El negocio ya genera ingresos"],
    ["diagnostico_previo", "Cuenta con diagnóstico o plan de negocio"],
    ["figura", "Figura legal"],
    ["rif", "RIF vigente"],
    ["declaraciones", "Declaraciones tributarias al día"],
    ["permisos", "Permisos municipales vigentes"],
    ["pendientes", "Aspectos que requieren revisión"],
    ["contabilidad", "Registros contables actualizados"],
    ["trabajadores", "Trabajadores contratados"],
    ["notificaciones", "Notificaciones, multas u obligaciones pendientes"],
    ["necesidades", "Áreas en las que busca apoyo"],
    ["reto", "Principal reto"],
    ["plazo", "Plazo para comenzar"],
    ["ingresos", "Ingresos mensuales aproximados"],
    ["referencia", "Cómo nos encontró"],
    ["notas", "Detalles de la consulta"],
    ["consentimiento", "Autorización para atender la consulta"],
  ];

  const labelFor = new Map(columns.map(([key, label]) => [key, label]));

  const collectData = () => {
    const formData = new FormData(form);
    const values = {};

    for (const [name] of columns) {
      const answers = formData.getAll(name).map((value) => String(value).trim()).filter(Boolean);
      if (answers.length) {
        values[name] = answers.length === 1 ? answers[0] : answers;
      }
    }

    const submittedAt = new Date().toISOString();
    const row = Object.fromEntries(
      columns.map(([key]) => {
        if (key === "submitted_at") {
          return [key, submittedAt];
        }
        const value = values[key];
        return [key, Array.isArray(value) ? value.join("; ") : value || ""];
      }),
    );
    const answers = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [labelFor.get(key), value]),
    );

    return { submittedAt, row, answers };
  };

  const csvCell = (value) => {
    const normalized = String(value ?? "").replace(/\r\n?/g, "\n");
    const safe = /^[\s]*[=+\-@\t]/.test(normalized) ? `'${normalized}` : normalized;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const createCsv = (row) => {
    const headers = columns.map(([, label]) => label);
    const values = columns.map(([key]) => row[key]);
    return `\uFEFF${headers.map(csvCell).join(";")}\r\n${values.map(csvCell).join(";")}\r\n`;
  };

  const downloadFile = (content, type, extension) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `DAVIS-SPI-diagnostico-${date}.${extension}`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const formatReport = ({ submittedAt, answers }) => {
    const lines = [
      "DAVIS SPI C.A. | DIAGNÓSTICO INICIAL",
      `Fecha: ${new Date(submittedAt).toLocaleString("es-VE", {
        dateStyle: "long",
        timeStyle: "short",
      })}`,
      "",
      ...Object.entries(answers).flatMap(([question, answer]) => [
        `${question}:`,
        Array.isArray(answer) ? `- ${answer.join("\n- ")}` : String(answer),
        "",
      ]),
    ];

    return lines.join("\n");
  };

  const showStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  };

  const showFieldValidation = (control, touched) => {
    if (!control.matches("input, select, textarea") || control.disabled) {
      return control.validity.valid;
    }
    if (touched) control.dataset.touched = "true";
    if (control.dataset.touched !== "true") return control.validity.valid;

    const invalid = !control.validity.valid;
    control.setAttribute("aria-invalid", String(invalid));
    const field = control.closest(".form-field");
    let error = field?.querySelector(".form-error");
    if (field && !error) {
      error = document.createElement("small");
      error.className = "form-error";
      error.id = `${form.id}-${control.name}-error`;
      error.hidden = true;
      error.setAttribute("role", "alert");
      field.append(error);
      const describedBy = (control.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter(Boolean);
      control.setAttribute("aria-describedby", [...new Set([...describedBy, error.id])].join(" "));
    }

    if (error) {
      error.textContent = control.validity.valueMissing
        ? "Completa este campo para continuar."
        : control.validity.typeMismatch
          ? "Revisa el formato de este dato."
          : control.validity.tooShort
            ? `Escribe al menos ${control.minLength} caracteres.`
            : "Revisa este dato antes de continuar.";
      error.hidden = !invalid;
    }
    return !invalid;
  };

  const validateForm = () => {
    for (const control of form.querySelectorAll(".form-field input, .form-field select, .form-field textarea")) {
      showFieldValidation(control, true);
    }
    return form.reportValidity();
  };

  const clearValidation = () => {
    for (const control of form.querySelectorAll("[data-touched], [aria-invalid]")) {
      delete control.dataset.touched;
      control.removeAttribute("aria-invalid");
    }
    for (const error of form.querySelectorAll(".form-error")) {
      error.hidden = true;
    }
  };

  const setDraftMessage = (message, isError = false) => {
    if (!draftStatus) return;
    draftStatus.textContent = message;
    draftStatus.classList.toggle("is-error", isError);
  };

  const readDraft = () => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (!saved) return null;
      const draft = JSON.parse(saved);
      if (
        !draft ||
        !Number.isFinite(draft.savedAt) ||
        draft.savedAt > Date.now() ||
        Date.now() - draft.savedAt > draftLifetimeMs
      ) {
        localStorage.removeItem(draftKey);
        setDraftMessage("El borrador anterior venció y se eliminó. Tus respuestas actuales se guardarán en este navegador durante 24 horas.");
        return null;
      }
      return draft;
    } catch {
      setDraftMessage("No fue posible acceder al almacenamiento local de este navegador. Puedes completar y enviar el formulario normalmente.", true);
      return null;
    }
  };

  const restoreDraft = (draft) => {
    const savedValues = draft.values;
    if (!savedValues || typeof savedValues !== "object") return;
    const restoreControls = () => {
      for (const [name, values] of Object.entries(savedValues)) {
        if (name === "website" || name === "consentimiento" || !Array.isArray(values)) continue;
        const controls = [...form.elements].filter((control) => control.name === name && !control.disabled);
        for (const control of controls) {
          if (control.type === "checkbox" || control.type === "radio") {
            control.checked = values.includes(control.value);
          } else if (control.tagName === "SELECT") {
            control.value = values.includes(control.value) ? control.value : values[0] || "";
          } else {
            control.value = values[0] || "";
          }
        }
      }
    };
    restoreControls();
    setFormalStatus();
    restoreControls();
    setFormalStatus();
    setDraftMessage("Restauramos un borrador reciente en este navegador. Tu autorización no se guardó; vuelve a marcarla antes de enviar.");
  };

  const saveDraft = () => {
    const values = {};
    for (const [name, value] of new FormData(form)) {
      if (name === "website" || name === "consentimiento") continue;
      if (!values[name]) values[name] = [];
      values[name].push(String(value));
    }
    try {
      localStorage.setItem(draftKey, JSON.stringify({ savedAt: Date.now(), values }));
      setDraftMessage("Borrador guardado en este navegador. Se eliminará automáticamente después de 24 horas.");
    } catch {
      setDraftMessage("No se pudo guardar el borrador local. Puedes seguir usando y enviar el formulario normalmente.", true);
    }
  };

  const clearDraft = (message = "Borrador local eliminado.") => {
    try {
      localStorage.removeItem(draftKey);
      setDraftMessage(message);
    } catch {
      setDraftMessage("No se pudo eliminar el borrador de este navegador.", true);
    }
  };

  const scheduleDraftSave = () => {
    window.clearTimeout(draftTimer);
    draftTimer = window.setTimeout(saveDraft, 400);
  };

  const setFormalStatus = () => {
    const selectedStage = form.querySelector('input[name="etapa"]:checked');
    const needsFormalDetails = selectedStage?.value.includes("constituida")
      || selectedStage?.value.includes("reactivar");

    formalGroup.hidden = !needsFormalDetails;

    for (const control of formalGroup.querySelectorAll("input, select, textarea")) {
      control.disabled = !needsFormalDetails;
      if (control.hasAttribute("data-formal-required")) {
        control.required = Boolean(needsFormalDetails);
      }
      if (!needsFormalDetails) {
        if (control.type === "checkbox" || control.type === "radio") {
          control.checked = false;
        } else {
          control.value = "";
        }
        control.removeAttribute("aria-invalid");
        delete control.dataset.touched;
        const error = control.closest(".form-field")?.querySelector(".form-error");
        if (error) error.hidden = true;
      }
    }
  };

  form.addEventListener("input", (event) => {
    if (event.target.name !== "website") {
      showFieldValidation(event.target, true);
      scheduleDraftSave();
    }
  });

  form.addEventListener("change", (event) => {
    if (event.target.name === "etapa") {
      setFormalStatus();
    }
    if (event.target.name !== "website") {
      showFieldValidation(event.target, true);
      scheduleDraftSave();
    }
  });

  clearDraftButton?.addEventListener("click", () => clearDraft());
  closeErrorDialog?.addEventListener("click", () => errorDialog?.close());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const honeypot = form.querySelector('[name="website"]');
    if (honeypot.value) {
      showStatus("No se pudo procesar el formulario. Intenta nuevamente.", true);
      return;
    }

    if (!validateForm()) {
      return;
    }

    const data = collectData();
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");
    submitButton.innerHTML = 'Enviando… <span aria-hidden="true">↗</span>';
    showStatus("Enviando tus respuestas de forma segura…");

    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          row: data.row,
          website: honeypot.value,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "No se pudo enviar la consulta.");
      }

      showStatus("¡Gracias! Recibimos tu diagnóstico y el equipo DAVIS SPI dará seguimiento a tu consulta.");
      form.reset();
      clearValidation();
      setFormalStatus();
      window.clearTimeout(draftTimer);
      clearDraft("Diagnóstico enviado. El borrador local se eliminó.");
    } catch (error) {
      const message = error.message || "No se pudo completar el envío.";
      showStatus(`${message} Tus respuestas siguen guardadas; también puedes exportar el CSV.`, true);
      if (errorDialog?.showModal) {
        document.querySelector("#submit-error-message").textContent =
          `${message} Tus respuestas permanecen guardadas en este navegador. Puedes exportar el CSV como respaldo.`;
        errorDialog.showModal();
        closeErrorDialog?.focus();
      }
    } finally {
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
      submitButton.innerHTML = 'Enviar diagnóstico <span aria-hidden="true">↗</span>';
    }
  });

  document.querySelector("#download-report")?.addEventListener("click", () => {
    if (!validateForm()) {
      return;
    }
    downloadFile(formatReport(collectData()), "text/plain;charset=utf-8", "txt");
    showStatus("Descargaste el informe de diagnóstico en formato de texto.");
  });

  document.querySelector("#download-csv")?.addEventListener("click", () => {
    if (!validateForm()) {
      return;
    }
    downloadFile(createCsv(collectData().row), "text/csv;charset=utf-8", "csv");
    showStatus("Descargaste el CSV compatible con Excel, con una columna por respuesta.");
  });

  document.querySelector("#download-json")?.addEventListener("click", () => {
    if (!validateForm()) {
      return;
    }
    downloadFile(
      JSON.stringify(collectData(), null, 2),
      "application/json;charset=utf-8",
      "json",
    );
    showStatus("Descargaste las respuestas estructuradas en formato JSON.");
  });

  const animatedElements = document.querySelectorAll(
    ".hero-copy, .hero-visual, .intro-content, .proof-strip, .service-card, .process-card, .principle, .diagnostic-benefit, .intake-intro, .diagnostic-form",
  );
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if ("IntersectionObserver" in window && !reducedMotion) {
    document.documentElement.classList.add("motion-ready");
    const observer = new IntersectionObserver((entries, currentObserver) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          currentObserver.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -36px 0px" });

    animatedElements.forEach((element, index) => {
      element.dataset.reveal = "";
      element.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 70}ms`);
      observer.observe(element);
    });
  }

  setFormalStatus();
  const draft = readDraft();
  if (draft) {
    restoreDraft(draft);
  }
})();
