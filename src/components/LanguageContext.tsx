"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { translations, Language } from "@/lib/i18n";

interface LanguageContextType {
    t: (key: string, params?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
    // const [language, setLanguageState] = useState<Language>("en");
    const language: Language = "en";

    // useEffect removed - no longer reading from localStorage

    // setLanguage removed


    const t = (path: string, params?: Record<string, string>): string => {
        const keys = path.split(".");
        let current: any = translations[language];

        for (const key of keys) {
            if (current[key] === undefined) {
                console.warn(`Missing translation for key: ${path}`);
                return path;
            }
            current = current[key];
        }

        if (typeof current !== "string") {
            return path;
        }

        let result = current;
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                result = result.replace(`{${key}}`, value);
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
