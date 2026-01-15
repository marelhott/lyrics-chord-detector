/**
 * Language selector component
 * Allows user to select language for transcription or use auto-detect
 */
export default function LanguageSelector({ value, onChange }) {
    const languages = [
        { code: null, name: 'Auto-detect', flag: '🌍' },
        { code: 'cs', name: 'Čeština', flag: '🇨🇿' },
        { code: 'sk', name: 'Slovenčina', flag: '🇸🇰' },
        { code: 'en', name: 'English', flag: '🇬🇧' },
        { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
        { code: 'fr', name: 'Français', flag: '🇫🇷' },
        { code: 'es', name: 'Español', flag: '🇪🇸' },
        { code: 'it', name: 'Italiano', flag: '🇮🇹' },
        { code: 'pl', name: 'Polski', flag: '🇵🇱' },
    ]

    return (
        <div className="space-y-1">
            <label className="text-[10px] font-black text-monstera-800 uppercase tracking-widest px-1">
                Jazyk
            </label>
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value || null)}
                className="w-full px-3 py-2 bg-white border border-monstera-200 rounded-md text-xs font-bold text-monstera-800 hover:border-monstera-400 transition-all focus:outline-none focus:ring-2 focus:ring-monstera-400"
            >
                {languages.map((lang) => (
                    <option key={lang.code || 'auto'} value={lang.code || ''}>
                        {lang.flag} {lang.name}
                    </option>
                ))}
            </select>
            <p className="text-[8px] text-monstera-500 px-1 leading-relaxed">
                Auto-detect funguje pro většinu jazyků
            </p>
        </div>
    )
}
