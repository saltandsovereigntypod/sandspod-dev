/* =========================================================
   RITUAL AUTOMATION
   Executes linked altar loading and supported step actions
   ========================================================= */

async function executeRitualStepActions(step, when) {
  if (!step || !Array.isArray(step.actions)) return;

  const actions = step.actions.filter((action) => action.when === when);

  for (const action of actions) {
    if (action.type === "light_all") {
      altarStage
        ?.querySelectorAll('.altar-object[data-type="candle"]')
        .forEach((candle) => {
          if (candle.dataset.lit === "true") return;
          candle.dataset.lit = "true";
          candle.classList.add("is-lit");
          if (typeof startFlame === "function") startFlame(candle);
        });

      if (typeof renderLighting === "function") renderLighting();
    }

    if (action.type === "extinguish_all") {
      altarStage
        ?.querySelectorAll('.altar-object[data-type="candle"]')
        .forEach((candle) => {
          candle.dataset.lit = "false";
          candle.classList.remove("is-lit", "has-flame-glow", "is-flame-glowing");

          if (typeof stopFlame === "function") stopFlame(candle);
          if (typeof extinguishFlame === "function") extinguishFlame(candle);

          candle.querySelectorAll(".candle-flame, .candle-glow, .flame-glow").forEach((effect) => {
            effect.remove();
          });
        });

      if (typeof renderLighting === "function") renderLighting();
    }
  }
}

async function loadLinkedAltarForTemplate(template) {
  if (!template?.linked_altar_id) return;

  const user = await getRitualUser();
  if (!user) return;

  const { data, error } = await db
    .from("saved_altars")
    .select("altar_data")
    .eq("id", template.linked_altar_id)
    .eq("user_id", user.id)
    .single();

  if (error) throw error;

  if (data?.altar_data && typeof restoreAltarData === "function") {
    restoreAltarData(data.altar_data);
  }
}

if (typeof createTemplateRitualSession === "function") {
  const originalCreateTemplateRitualSession = createTemplateRitualSession;

  createTemplateRitualSession = async function createTemplateRitualSessionWithAutomation(template) {
    await loadLinkedAltarForTemplate(template);

    const session = await originalCreateTemplateRitualSession(template);
    const firstStep = activeRitualSteps.find((step) => step.status === "active");

    if (firstStep) {
      await executeRitualStepActions(firstStep, "start");
      if (typeof appendRitualEvent === "function") {
        await appendRitualEvent("step_actions_started", {
          stepId: firstStep.id,
          sortOrder: firstStep.sort_order
        });
      }
    }

    return session;
  };
}

if (typeof completeCurrentRitualStep === "function") {
  const originalCompleteCurrentRitualStep = completeCurrentRitualStep;

  completeCurrentRitualStep = async function completeCurrentRitualStepWithAutomation(options = {}) {
    const currentStep = getCurrentRitualStep();

    if (currentStep) {
      await executeRitualStepActions(currentStep, "end");
    }

    const result = await originalCompleteCurrentRitualStep(options);
    const nextStep = getCurrentRitualStep();

    if (nextStep && nextStep.id !== currentStep?.id && nextStep.status === "active") {
      await executeRitualStepActions(nextStep, "start");
    }

    return result;
  };
}
