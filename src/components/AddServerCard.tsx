
import React from 'react';
import { useLanguage } from './LanguageContext';

interface AddServerCardProps {
    onClick: () => void;
}

export const AddServerCard: React.FC<AddServerCardProps> = ({ onClick }) => {
    const { t } = useLanguage();

    return (
        <button
            onClick={onClick}
            data-testid="btn-add-server-card"
            className="group flex h-40 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/20 bg-white/5 p-6 transition hover:border-amber-400 hover:bg-white/10"
        >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition group-hover:bg-amber-400 group-hover:text-slate-900">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
                </svg>
            </div>
            <span className="font-medium text-white/70 group-hover:text-amber-400">{t("settings.addServer")}</span>
        </button>
    );
};
