"use client"

import { useState } from 'react'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TimezoneSelector } from '@/components/TimezoneSelector'
import { toast } from 'sonner'
import { Loader2, Settings, Clock, Save } from 'lucide-react'
import { getCurrentTimeInTimezone } from '@/lib/timezone-utils'

export default function SettingsPage() {
  const { preferences, loading, updateTimezone, userTimezone } = useUserPreferences()
  const [selectedTimezone, setSelectedTimezone] = useState(userTimezone)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (selectedTimezone === userTimezone) {
      toast.info('No changes to save')
      return
    }

    setSaving(true)
    try {
      await updateTimezone(selectedTimezone)
      toast.success('Timezone preference updated!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update timezone')
      setSelectedTimezone(userTimezone) // Reset on error
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Settings className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-slate-400">Manage your account preferences</p>
      </div>

      <Card className="bg-slate-800/50 border-slate-700 mb-6">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timezone Preferences
          </CardTitle>
          <CardDescription className="text-slate-400">
            Set your timezone to ensure posts are scheduled and displayed in your local time
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <TimezoneSelector
                value={selectedTimezone}
                onValueChange={setSelectedTimezone}
                label="Your Timezone"
              />
            </div>
            <div className="space-y-2">
              <label className="text-slate-300 text-sm font-medium">Current Time</label>
              <div className="p-3 bg-slate-900/50 border border-slate-600 rounded-md">
                <p className="text-white font-mono">
                  {getCurrentTimeInTimezone(selectedTimezone)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedTimezone}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/30 border border-slate-700 rounded-lg p-4">
            <h4 className="text-white font-medium mb-2">How timezone settings work:</h4>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• All scheduled posts will be displayed in your selected timezone</li>
              <li>• When you schedule a post, it will be published at the exact time you specify</li>
              <li>• Changing your timezone won't affect existing scheduled posts</li>
              <li>• Your timezone preference is saved and applied to all future posts</li>
            </ul>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={handleSave}
              disabled={saving || selectedTimezone === userTimezone}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
            <Button
              variant="outline"
              onClick={() => setSelectedTimezone(userTimezone)}
              disabled={selectedTimezone === userTimezone}
              className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {preferences && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Current Preferences</CardTitle>
            <CardDescription className="text-slate-400">
              Your saved account preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-700">
                <span className="text-slate-300">Timezone</span>
                <span className="text-white font-mono">{preferences.timezone}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-700">
                <span className="text-slate-300">Last Updated</span>
                <span className="text-white">
                  {new Date(preferences.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}