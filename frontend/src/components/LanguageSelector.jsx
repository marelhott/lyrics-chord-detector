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
        <div className="space-y-3">
            <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Language
            </label>
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value || null)}
                className="w-full px-4 py-3 glass rounded-xl text-sm font-semibold text-neutral-200 hover:border-accent-purple/50 transition-all focus:outline-none focus:ring-2 focus:ring-accent-purple/50 focus:border-accent-purple cursor-pointer"
            >
                {languages.map((lang) => (
                    <option key={lang.code || 'auto'} value={lang.code || ''} className="bg-dark-800">
                        {lang.flag} {lang.name}
                    </option>
                ))}
            </select>
            <p className="text-xs text-neutral-500 leading-relaxed">
                Auto-detect works for most languages
            </p>
        </div>
    )
}
