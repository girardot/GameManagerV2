import { useEffect, useState } from 'react'
import { LogOut, Upload, Download, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { useConsoles } from '../hooks/useConsoles'
import { supabase } from '../lib/supabase'
import { importFromExcel } from '../lib/import-xlsx'
import { exportToExcel } from '../lib/export-xlsx'
import { Button, Input, Card, Label } from '../components/ui'
import { appVersionLabel } from '../lib/version'
import type { ExportReport, ImportReport } from '../types'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { profile, loading: profileLoading, saveDisplayName } = useProfile()
  const { consoles, addConsole, deleteConsole } = useConsoles()
  const [displayName, setDisplayName] = useState('')
  const [displayNameSaving, setDisplayNameSaving] = useState(false)
  const [displayNameError, setDisplayNameError] = useState<string | null>(null)
  const [displayNameSuccess, setDisplayNameSuccess] = useState(false)
  const [consoleName, setConsoleName] = useState('')
  const [consoleError, setConsoleError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [addTodoToQueue, setAddTodoToQueue] = useState(true)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [exportReport, setExportReport] = useState<ExportReport | null>(null)

  useEffect(() => {
    if (profile?.display_name != null) {
      setDisplayName(profile.display_name)
    } else if (user?.email) {
      setDisplayName(user.email.split('@')[0])
    }
  }, [profile?.display_name, user?.email])

  const handleSaveDisplayName = async () => {
    setDisplayNameSaving(true)
    setDisplayNameError(null)
    setDisplayNameSuccess(false)
    const { error } = await saveDisplayName(displayName)
    if (error) setDisplayNameError(error)
    else setDisplayNameSuccess(true)
    setDisplayNameSaving(false)
  }

  const handleAddConsole = async () => {
    if (!consoleName.trim()) return
    const { error } = await addConsole(consoleName)
    if (error) setConsoleError(error)
    else {
      setConsoleError(null)
      setConsoleName('')
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !supabase || !user) return
    setImporting(true)
    setReport(null)
    setExportReport(null)
    try {
      const result = await importFromExcel(
        file,
        supabase,
        user.id,
        addTodoToQueue
      )
      setReport(result)
    } catch (err) {
      setReport({
        consolesCreated: 0,
        gamesCreated: 0,
        gamesSkipped: 0,
        buyCreated: 0,
        buySkipped: 0,
        playQueueCreated: 0,
        errors: [String(err)],
      })
    }
    setImporting(false)
    e.target.value = ''
  }

  const handleExport = async () => {
    if (!supabase || !user) return
    setExporting(true)
    setExportReport(null)
    setReport(null)
    try {
      const result = await exportToExcel(supabase, user.id)
      setExportReport(result)
    } catch (err) {
      setExportReport({
        gamesCount: 0,
        buyCount: 0,
        playQueueCount: 0,
        error: String(err),
      })
    }
    setExporting(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-xs text-slate-500 md:hidden">{appVersionLabel()}</p>
      </div>

      <Card>
        <h2 className="mb-2 font-semibold">Compte</h2>
        <p className="text-sm text-slate-400 break-all">{user?.email}</p>
        <div className="mt-4 space-y-2">
          <Label>Pseudo (visible par vos amis)</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value)
                setDisplayNameSuccess(false)
              }}
              placeholder="Votre pseudo"
              maxLength={50}
              disabled={profileLoading || displayNameSaving}
              className="flex-1"
            />
            <Button
              onClick={handleSaveDisplayName}
              disabled={
                profileLoading ||
                displayNameSaving ||
                !displayName.trim()
              }
            >
              {displayNameSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
          {displayNameError && (
            <p className="text-sm text-red-400">{displayNameError}</p>
          )}
          {displayNameSuccess && (
            <p className="text-sm text-green-400">Pseudo enregistré.</p>
          )}
        </div>
        <Button variant="ghost" className="mt-3" onClick={() => signOut()}>
          <LogOut className="h-4 w-4" />
          Déconnexion
        </Button>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Consoles</h2>
        <div className="flex gap-2 mb-3">
          <Input
            placeholder="Nom de la console"
            value={consoleName}
            onChange={(e) => setConsoleName(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleAddConsole}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {consoleError && (
          <p className="mb-2 text-sm text-red-400">{consoleError}</p>
        )}
        <ul className="space-y-1">
          {consoles.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2 text-sm"
            >
              <span>{c.name}</span>
              <button
                type="button"
                onClick={async () => {
                  if (confirm(`Supprimer ${c.name} ?`)) {
                    await deleteConsole(c.id)
                  }
                }}
                className="text-slate-400 hover:text-red-400 p-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Excel</h2>
        <p className="mb-4 text-sm text-slate-400">
          Import et export au format Games.xlsx (feuilles Games, To Buy et To Play).
        </p>

        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-medium flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export
            </h3>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? 'Export en cours…' : 'Télécharger Games.xlsx'}
            </Button>
            {exportReport && !exportReport.error && (
              <p className="mt-2 text-sm text-green-400">
                Export réussi : {exportReport.gamesCount} jeux,{' '}
                {exportReport.buyCount} à acheter, {exportReport.playQueueCount}{' '}
                à jouer.
              </p>
            )}
            {exportReport?.error && (
              <p className="mt-2 text-sm text-red-400">{exportReport.error}</p>
            )}
          </div>

          <div className="border-t border-slate-800 pt-4">
            <h3 className="mb-2 text-sm font-medium flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Import
            </h3>
            <label className="mb-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={addTodoToQueue}
                onChange={(e) => setAddTodoToQueue(e.target.checked)}
                className="h-4 w-4"
              />
              Ajouter les jeux TODO / En cours à la file « À jouer »
            </label>
            <label className="block">
              <span className="sr-only">Fichier Excel</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                disabled={importing}
                onChange={handleImport}
                className="text-sm text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:text-white"
              />
            </label>
            {importing && (
              <p className="mt-2 text-sm text-slate-400">Import en cours…</p>
            )}
            {report && (
              <div className="mt-4 rounded-lg bg-slate-800 p-3 text-sm space-y-1">
                <p>Consoles créées : {report.consolesCreated}</p>
                <p>Jeux importés : {report.gamesCreated}</p>
                <p>Jeux ignorés (doublons) : {report.gamesSkipped}</p>
                <p>À acheter importés : {report.buyCreated}</p>
                <p>File à jouer : {report.playQueueCreated}</p>
                {report.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-red-400 cursor-pointer">
                      {report.errors.length} erreur(s)
                    </summary>
                    <ul className="mt-1 text-xs text-red-300 max-h-32 overflow-y-auto">
                      {report.errors.slice(0, 20).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
