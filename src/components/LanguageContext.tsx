"use client";

import { createContext, useContext, ReactNode } from "react";
import { translations, Language } from "@/lib/i18n";

interface LanguageContextType {
    t: (key: string, params?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
    // The UI ships English-only; the Language type keeps the lookup typed.
    const language: Language = "en";

    const t = (path: string, params?: Record<string, string>): string => {
        const keys = path.split(".");
        let current: unknown = translations[language];

        for (const key of keys) {
            const next = typeof current === "object" && current !== null
                ? (current as Record<string, unknown>)[key]
                : undefined;
            if (next === undefined) {
                console.warn(`Missing translation for key: ${path}`);
                return path;
            }
            current = next;
        }

        if (typeof current !== "string") {
            return path;
        }

        let result: string = current;
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                result = result.replaceAll(`{${key}}`, value);
            });
        }

        return result;
    };

    return (
        <LanguageContext.Provider value={{ t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
};
