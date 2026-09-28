import clsx from "clsx";
import type { RuleInstance } from "@/features/rules/types";
import { LIMIT_BOUNDS, RULE_NAME_MAX_LENGTH, RULE_TYPE } from "@/features/rules/constants";
import type { RuleFormErrors } from "@/features/rules/utils/ruleValidation";
import ScheduledAccessForm from "./ScheduledAccessForm";
import EnforcementForm from "./EnforcementForm";
import FieldError from "./FieldError";

export const ruleFieldId = (field: string) => `rule-field-${field}`;

const NAME_PLACEHOLDERS: Record<string, string> = {
    [RULE_TYPE.SCHEDULED]: "e.g. Kids Bedtime",
    [RULE_TYPE.KILL_PAUSED]: "e.g. Auto-Kill Paused Streams",
};
const DEFAULT_NAME_PLACEHOLDER = "e.g. Gold Tier Limit";

const LIMIT_LABELS: Record<string, string> = {
    [RULE_TYPE.KILL_PAUSED]: "Time Limit (Minutes)",
    [RULE_TYPE.SCHEDULED]: "Schedule Configuration",
};
const DEFAULT_LIMIT_LABEL = "Stream Limit";

const inputClass = (hasError: boolean) =>
    clsx(
        "w-full bg-black/20 border rounded-xl px-4 py-3 text-white focus:outline-none placeholder:text-white/20",
        hasError ? "border-rose-500/60 focus:border-rose-500" : "border-white/10 focus:border-amber-500"
    );

interface ConfigTabProps {
    formData: RuleInstance;
    setFormData: (rule: RuleInstance) => void;
    limitInput: string;
    setLimitInput: (value: string) => void;
    errors: RuleFormErrors;
    onSubmit: () => void;
}

export default function ConfigTab({ formData, setFormData, limitInput, setLimitInput, errors, onSubmit }: ConfigTabProps) {
    const bounds = LIMIT_BOUNDS[formData.type];
    const isScheduled = formData.type === RULE_TYPE.SCHEDULED;

    return (
        <form
            id="rule-form"
            noValidate
            onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
            }}
            className="space-y-6"
        >
            <div>
                <label htmlFor={ruleFieldId("name")} className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">
                    Rule Name
                </label>
                <input
                    id={ruleFieldId("name")}
                    value={formData.name}
                    maxLength={RULE_NAME_MAX_LENGTH}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={inputClass(!!errors.name)}
                    placeholder={NAME_PLACEHOLDERS[formData.type] ?? DEFAULT_NAME_PLACEHOLDER}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? `${ruleFieldId("name")}-error` : undefined}
                    required
                />
                <FieldError id={`${ruleFieldId("name")}-error`} message={errors.name} />
            </div>

            <div>
                <label htmlFor={bounds ? ruleFieldId("limit") : undefined} className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">
                    {LIMIT_LABELS[formData.type] ?? DEFAULT_LIMIT_LABEL}
                </label>
                {bounds && (
                    <>
                        <input
                            id={ruleFieldId("limit")}
                            type="number"
                            inputMode="numeric"
                            min={bounds.min}
                            max={bounds.max}
                            step={1}
                            value={limitInput}
                            onChange={(e) => setLimitInput(e.target.value)}
                            className={inputClass(!!errors.limit)}
                            aria-invalid={!!errors.limit}
                            aria-describedby={clsx(`${ruleFieldId("limit")}-hint`, errors.limit && `${ruleFieldId("limit")}-error`)}
                        />
                        <FieldError id={`${ruleFieldId("limit")}-error`} message={errors.limit} />
                        <p id={`${ruleFieldId("limit")}-hint`} className="text-xs text-white/40 mt-1">
                            {formData.type === RULE_TYPE.KILL_PAUSED && "Sessions paused for longer than this will be terminated. "}
                            {`Allowed: ${bounds.min}–${bounds.max} ${bounds.unit}.`}
                        </p>
                    </>
                )}
                {isScheduled && (
                    <p className="text-xs text-white/40 mt-1">Configure time windows when access should be blocked or allowed below.</p>
                )}
            </div>

            <div className="bg-white/5 rounded-xl p-4 space-y-4 border border-white/5">
                {isScheduled ? (
                    <ScheduledAccessForm formData={formData} setFormData={setFormData} />
                ) : (
                    <EnforcementForm formData={formData} setFormData={setFormData} />
                )}
                <FieldError id={`${ruleFieldId("schedule")}-error`} message={errors.schedule} />
            </div>
        </form>
    );
}
