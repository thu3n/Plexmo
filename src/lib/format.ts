
export const formatDate = (dateInput: string | number | Date): string => {
    if (!dateInput) return "";
    const date = new Date(dateInput);
    const yy = date.getFullYear();
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
};

export const formatTime = (dateInput: string | number | Date): string => {
    if (!dateInput) return "";
    const date = new Date(dateInput);
    const hh = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${hh}:${min}`;
};

export const formatDateTime = (dateInput: string | number | Date): string => {
    if (!dateInput) return "";
    return `${formatDate(dateInput)} ${formatTime(dateInput)}`;
};
