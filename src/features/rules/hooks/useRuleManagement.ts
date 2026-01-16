"use client";

import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface RuleInstance {
    id?: string;
    type: string;
    name: string;
    enabled: boolean;
    settings: {
        limit: number;
        enforce: boolean;
        kill_all: boolean;
        message: string;
        notify?: boolean;
    };
    discordWebhookId: string | null;
    discordWebhookIds?: string[];
    global?: boolean;
    userCount?: number;
    serverCount?: number;
}

export function useRuleManagement() {
    const { data: rules, error, mutate } = useSWR<RuleInstance[]>("/api/rules/instances", fetcher);
    const [selectedRule, setSelectedRule] = useState<RuleInstance | undefined>(undefined);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTypeSelectionOpen, setIsTypeSelectionOpen] = useState(false);

    const openCreateModal = () => {
        setIsTypeSelectionOpen(true);
    };

    const selectRuleType = (type: string) => {
        setIsTypeSelectionOpen(false);
        // Initialize new rule with selected type
        setSelectedRule({
            type,
            name: "",
            enabled: true,
            settings: {
                limit: 1,
                enforce: false,
                kill_all: false,
                message: ""
            },
            discordWebhookId: null,
            discordWebhookIds: []
        });
        setIsModalOpen(true);
    };

    const openEditModal = (rule: RuleInstance) => {
        setSelectedRule(rule);
        setIsModalOpen(true);
    };

    const closeModals = () => {
        setIsModalOpen(false);
        setIsTypeSelectionOpen(false);
        setSelectedRule(undefined);
    };

    const deleteRule = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

        try {
            await fetch(`/api/rules/instances/${id}`, { method: "DELETE" });
            mutate();
        } catch (error) {
            console.error("Failed to delete rule", error);
        }
    };

    const toggleRule = async (id: string, enabled: boolean) => {
        // Optimistic update
        mutate(
            rules?.map(r => r.id === id ? { ...r, enabled } : r),
            false
        );

        try {
            const rule = rules?.find(r => r.id === id);
            if (rule) {
                await fetch(`/api/rules/instances/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...rule, enabled }),
                });
                mutate();
            }
        } catch (error) {
            console.error("Failed to toggle rule", error);
            mutate(); // Revert
        }
    };

    const saveRule = async (rule: RuleInstance) => {
        try {
            if (rule.id) {
                // Update
                await fetch(`/api/rules/instances/${rule.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(rule),
                });
            } else {
                // Create
                await fetch("/api/rules/instances", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(rule),
                });
            }
            mutate();
            setIsModalOpen(false);
        } catch (error) {
            console.error("Failed to save rule", error);
            throw error;
        }
    };

    return {
        rules,
        isLoading: !rules && !error,
        error,
        selectedRule,
        isModalOpen,
        isTypeSelectionOpen,
        actions: {
            openCreateModal,
            selectRuleType,
            openEditModal,
            closeModals,
            deleteRule,
            toggleRule,
            saveRule
        }
    };
}
