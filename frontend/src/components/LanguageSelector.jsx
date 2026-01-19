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
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Language
            </label>
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value || null)}
                className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm font-semibold text-foreground hover:border-primary/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary cursor-pointer"
            >
                {languages.map((lang) => (
                    <option key={lang.code || 'auto'} value={lang.code || ''} className="bg-background text-foreground">
                        {lang.flag} {lang.name}
                    </option>
                ))}
            </select>
            <p className="text-xs text-muted-foreground/70 leading-relaxed">
                Auto-detect works for most languages
            </p>
        </div>
    )
}

