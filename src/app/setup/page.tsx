"use client";

import { useLanguage } from "@/components/LanguageContext";
import { SetupShell } from "@/features/setup/components/SetupShell";
import { SetupWizard } from "@/features/setup/components/SetupWizard";

export default function OnboardingPage() {
    const { t } = useLanguage();
    return (
        <SetupShell title={t("onboarding.title")} subtitle={t("onboarding.subtitle")}>
            <SetupWizard mode="setup" />
        </SetupShell>
    );
}
