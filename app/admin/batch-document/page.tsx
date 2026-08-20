'use client'

import { Suspense, useEffect, useState, useMemo, useCallback } from 'react'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'
import type { TableRow } from '../../lib/supabase/database.types'
import { extractBatchFromIndex } from '../../lib/validation'

const supabase = createBrowserSupabaseClient()

type MedicalRecordWithStudent = TableRow<'medical_records'> & {
  students: Pick<TableRow<'students'>, 'full_name' | 'index_no' | 'faculty'> | null
}

type UnifiedScheduleItem = {
  id: string
  itemType: 'certificate' | 'visit'
  studentName: string
  indexNo: string
  durationStr: string
  startDate: string
  endDate: string
  leaveDays: number
  holidays: number
  leaveMonth: string
  approvalMonth: string
  isDelayed: boolean
  previousNote: string
}

// Helper to extract leave month (e.g. '2026-06')
const getLeaveMonth = (r: MedicalRecordWithStudent) => {
  const dateStr = r.leave_start_date || r.issue_date || r.created_at
  return dateStr ? dateStr.slice(0, 7) : ''
}

// Helper to extract approval / processing month (e.g. '2026-08')
const getApprovalMonth = (r: MedicalRecordWithStudent) => {
  const dateStr = r.resubmitted_at || r.updated_at || r.issue_date || r.created_at
  return dateStr ? dateStr.slice(0, 7) : ''
}

// Check if a record is a delayed / past-month approval
const isDelayedApproval = (r: MedicalRecordWithStudent) => {
  const leaveMonth = getLeaveMonth(r)
  const approvalMonth = getApprovalMonth(r)
  return Boolean(
    approvalMonth &&
    leaveMonth &&
    approvalMonth > leaveMonth &&
    (r.resubmitted_at || (r.resubmission_count && r.resubmission_count > 0) || r.rejection_reason || r.resubmission_reason)
  )
}

export default function AdminBatchDocumentPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading document...</div>}>
      <AdminBatchDocument />
    </Suspense>
  )
}

function AdminBatchDocument() {
  const [records, setRecords] = useState<MedicalRecordWithStudent[]>([])
  const [visits, setVisits] = useState<TableRow<'medical_visits'>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Filtering states
  const [filterMode, setFilterMode] = useState<'month' | 'range'>('month')
  const [selectedBatch, setSelectedBatch] = useState<string>('All')
  const [selectedMonth, setSelectedMonth] = useState<string>('All')
  const [dateRangeStart, setDateRangeStart] = useState<string>('')
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'certificate' | 'visit'>('all')

  // Dispatch state
  const [dispatching, setDispatching] = useState(false)
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState('')
  const [dispatchedAt, setDispatchedAt] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('wusl_last_batch_dispatch') || null
    }
    return null
  })

  const fetchScheduleData = useCallback(async () => {
    setLoading(true)
    const [recordsRes, visitsRes] = await Promise.all([
      supabase
        .from('medical_records')
        .select('*, students(full_name, index_no, faculty)')
        .eq('status', 'approved')
        .eq('lifecycle_status', 'active')
        .order('issue_date', { ascending: true }),
      supabase
        .from('medical_visits')
        .select('*')
        .eq('patient_type', 'Student')
        .neq('status', 'voided')
        .order('visit_date', { ascending: true }),
    ])

    if (recordsRes.error) {
      setError(recordsRes.error.message)
      setRecords([])
    } else {
      setRecords(
        (recordsRes.data || []).map(r => ({
          ...r,
          students: Array.isArray(r.students) ? r.students[0] || null : r.students,
        }))
      )
      setError('')
    }

    if (visitsRes.data) {
      setVisits(visitsRes.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchScheduleData()

    const recordsChan = supabase
      .channel('admin-batch-records-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_records' }, () => {
        void fetchScheduleData()
      })
      .subscribe()

    const visitsChan = supabase
      .channel('admin-batch-visits-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_visits' }, () => {
        void fetchScheduleData()
      })
      .subscribe()

    const onFocus = () => { void fetchScheduleData() }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void fetchScheduleData()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void supabase.removeChannel(recordsChan)
      void supabase.removeChannel(visitsChan)
    }
  }, [fetchScheduleData])

  // Convert raw records and clinic visits into unified schedule items
  const unifiedItems: UnifiedScheduleItem[] = useMemo(() => {
    const certItems: UnifiedScheduleItem[] = records.map(r => {
      const sDate = r.leave_start_date || r.issue_date || ''
      const eDate = r.leave_end_date || r.leave_start_date || r.issue_date || ''
      const formattedS = sDate.replace(/-/g, '/')
      const formattedE = eDate.replace(/-/g, '/')
      const durationStr = formattedS === formattedE ? formattedS : `${formattedS} TO ${formattedE}`

      return {
        id: `rec-${r.record_id}`,
        itemType: 'certificate',
        studentName: r.students?.full_name || 'Student',
        indexNo: r.students?.index_no || '',
        startDate: sDate,
        endDate: eDate,
        durationStr,
        leaveDays: r.leave_days_count || 1,
        holidays: r.number_of_holidays || 0,
        leaveMonth: getLeaveMonth(r),
        approvalMonth: getApprovalMonth(r),
        isDelayed: isDelayedApproval(r),
        previousNote: r.previous_leave_summary || '',
      }
    })

    const visitItems: UnifiedScheduleItem[] = visits.map(v => {
      const visitDate = v.visit_date || ''
      const visitDateFormatted = visitDate.replace(/-/g, '/')
      return {
        id: `vis-${v.visit_id}`,
        itemType: 'visit',
        studentName: v.patient_name || 'Student',
        indexNo: v.patient_index || '',
        startDate: visitDate,
        endDate: visitDate,
        durationStr: `${visitDateFormatted} (Clinic Visit)`,
        leaveDays: 1,
        holidays: 0,
        leaveMonth: visitDate.slice(0, 7),
        approvalMonth: visitDate.slice(0, 7),
        isDelayed: false,
        previousNote: v.reason ? `Clinic: ${v.reason}` : 'Clinic Consultation',
      }
    })

    return [...certItems, ...visitItems]
  }, [records, visits])

  // Extract distinct available months from unified data, grouped by Year (capped at recent 24 months)
  const groupedMonths = useMemo(() => {
    const map = new Map<string, string>()
    const currentYm = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

    unifiedItems.forEach(item => {
      const lm = item.leaveMonth
      if (lm && lm.length === 7) {
        const [year, month] = lm.split('-')
        const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1)
        const label = dateObj.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
        map.set(lm, lm === currentYm ? `${label} (Current)` : label)
      }

      if (item.isDelayed && item.approvalMonth && item.approvalMonth.length === 7) {
        const [year, month] = item.approvalMonth.split('-')
        const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1)
        const label = dateObj.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
        map.set(item.approvalMonth, item.approvalMonth === currentYm ? `${label} (Current)` : label)
      }
    })

    if (!map.has(currentYm)) {
      const [cy, cm] = currentYm.split('-')
      const curLabel = new Date(parseInt(cy, 10), parseInt(cm, 10) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      map.set(currentYm, `${curLabel} (Current)`)
    }

    // Limit to the most recent 24 rolling months to prevent overflow
    const sortedEntries = Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 24)

    // Group by Year
    const byYear = new Map<string, Array<{ ym: string; label: string }>>()
    sortedEntries.forEach(([ym, label]) => {
      const year = ym.split('-')[0]
      if (!byYear.has(year)) byYear.set(year, [])
      byYear.get(year)!.push({ ym, label })
    })

    return Array.from(byYear.entries())
  }, [unifiedItems])

  // Extract all available batches from the dataset
  const availableBatches = useMemo(() => {
    const set = new Set<string>()
    unifiedItems.forEach(item => {
      const b = extractBatchFromIndex(item.indexNo)
      if (b && b !== 'General') set.add(b)
    })
    return ['All Batches', ...Array.from(set).sort()]
  }, [unifiedItems])

  // Filter items by Month / Date Range, Batch, and Item Type
  const filteredItems = useMemo(() => {
    return unifiedItems.filter(item => {
      let matchesTime = false

      if (filterMode === 'month') {
        if (selectedMonth === 'All') {
          matchesTime = true
        } else if (item.leaveMonth === selectedMonth) {
          matchesTime = true
        } else if (item.isDelayed && item.approvalMonth === selectedMonth) {
          matchesTime = true
        }
      } else {
        // Custom Date Range filter
        const start = dateRangeStart || '1970-01-01'
        const end = dateRangeEnd || '2099-12-31'
        const overlaps = item.startDate <= end && item.endDate >= start
        matchesTime = overlaps
      }

      const batch = extractBatchFromIndex(item.indexNo)
      const matchesBatch = selectedBatch === 'All' || selectedBatch === 'All Batches' || batch === selectedBatch

      const matchesType = typeFilter === 'all' || item.itemType === typeFilter

      return matchesTime && matchesBatch && matchesType
    })
  }, [unifiedItems, filterMode, selectedMonth, dateRangeStart, dateRangeEnd, selectedBatch, typeFilter])

  // Compute student cumulative leave count per month across both certificates and visits
  const monthlyStudentLeaveMap = useMemo(() => {
    const map = new Map<string, number>()
    unifiedItems.forEach(item => {
      const key = `${item.indexNo}-${item.leaveMonth}`
      const current = map.get(key) || 0
      map.set(key, current + item.leaveDays)
    })
    return map
  }, [unifiedItems])

  // Formatted date string for the document header
  const formattedHeaderDate = useMemo(() => {
    if (filterMode === 'range') {
      if (dateRangeStart && dateRangeEnd) {
        if (dateRangeStart === dateRangeEnd) {
          const d = new Date(dateRangeStart)
          return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
        }
        return `PERIOD: ${dateRangeStart.replace(/-/g, '/')} TO ${dateRangeEnd.replace(/-/g, '/')}`
      }
      if (dateRangeStart) return `FROM ${dateRangeStart.replace(/-/g, '/')}`
      if (dateRangeEnd) return `UNTIL ${dateRangeEnd.replace(/-/g, '/')}`
      return 'CUSTOM ATTENDANCE SCHEDULE'
    }

    if (selectedMonth === 'All') return 'ALL APPROVED ATTENDANCE SCHEDULE'
    const [year, month] = selectedMonth.split('-')
    const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1)
    return dateObj.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase()
  }, [filterMode, selectedMonth, dateRangeStart, dateRangeEnd])

  // Dispatch batch to 4 departments via API
  const handleDispatchBatch = async () => {
    if (dispatching) return
    setDispatching(true)
    setDispatchSuccessMsg('')

    const periodLabel = filterMode === 'month' ? selectedMonth : `${dateRangeStart} to ${dateRangeEnd}`

    try {
      const res = await fetch('/api/admin/batch-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: periodLabel,
          batch: selectedBatch,
          totalRecords: filteredItems.length,
          totalStudents: new Set(filteredItems.map(i => i.indexNo)).size,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        const formattedTime = new Date().toLocaleString('en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
        setDispatchedAt(formattedTime)
        if (typeof window !== 'undefined') {
          localStorage.setItem('wusl_last_batch_dispatch', formattedTime)
        }
        setDispatchSuccessMsg(
          `Schedule officially dispatched to 4 departments (CIS, ELT, MS, IM) via notification email at ${formattedTime}.`
        )
      } else {
        alert(data.error || 'Unable to dispatch batch schedule.')
      }
    } catch (err) {
      console.error(err)
      alert('Failed to dispatch batch schedule. Please try again.')
    } finally {
      setDispatching(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Sleek Control Card - Hidden during printing */}
      <div className="print:hidden bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-5">
        {/* Header Row: Title on Left, Grouped Action Buttons on Right */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                Medical Center Administration
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mt-1">Batch Medical & Attendance Schedule</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Consolidated medical certificates and clinic attendance records for the 4 departments.
            </p>
          </div>

          {/* Action Buttons Group */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => void fetchScheduleData()}
              className="h-9 border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              title="Refresh records"
            >
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button
              onClick={handleDispatchBatch}
              disabled={dispatching || filteredItems.length === 0}
              className="h-9 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white px-3.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              {dispatching ? 'Dispatching...' : 'Dispatch to 4 Departments'}
            </button>
            <button
              onClick={handlePrint}
              className="h-9 bg-blue-800 hover:bg-blue-900 text-white px-3.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / PDF
            </button>
          </div>
        </div>

        {/* Clean Balanced 3-Column Filter Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100 text-xs">
          {/* Column 1: Time Period with Toggle */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700">Time Period</span>
              <div className="bg-gray-100 p-0.5 rounded-lg flex gap-0.5">
                <button
                  type="button"
                  onClick={() => setFilterMode('month')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                    filterMode === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  By Month
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('range')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                    filterMode === 'range' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Date Range
                </button>
              </div>
            </div>

            {filterMode === 'month' ? (
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="h-9 border border-gray-200 rounded-lg px-3 bg-gray-50/50 text-xs text-gray-800 focus:outline-none focus:border-blue-800 focus:bg-white transition-colors"
              >
                <option value="All">All Months (Show All)</option>
                {groupedMonths.map(([year, months]) => (
                  <optgroup key={year} label={`Year ${year}`}>
                    {months.map(({ ym, label }) => (
                      <option key={ym} value={ym}>
                        {label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={dateRangeStart}
                  onChange={e => setDateRangeStart(e.target.value)}
                  placeholder="From"
                  className="h-9 border border-gray-200 rounded-lg px-2.5 bg-gray-50/50 text-xs text-gray-800 focus:outline-none focus:border-blue-800 focus:bg-white"
                />
                <input
                  type="date"
                  value={dateRangeEnd}
                  onChange={e => setDateRangeEnd(e.target.value)}
                  placeholder="To"
                  className="h-9 border border-gray-200 rounded-lg px-2.5 bg-gray-50/50 text-xs text-gray-800 focus:outline-none focus:border-blue-800 focus:bg-white"
                />
              </div>
            )}
          </div>

          {/* Column 2: Batch Selection */}
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-gray-700">Batch Filter</span>
            <select
              value={selectedBatch}
              onChange={e => setSelectedBatch(e.target.value)}
              className="h-9 border border-gray-200 rounded-lg px-3 bg-gray-50/50 text-xs text-gray-800 focus:outline-none focus:border-blue-800 focus:bg-white transition-colors"
            >
              {availableBatches.map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Column 3: Scope Selection */}
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-gray-700">Schedule Scope</span>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as 'all' | 'certificate' | 'visit')}
              className="h-9 border border-gray-200 rounded-lg px-3 bg-gray-50/50 text-xs text-gray-800 focus:outline-none focus:border-blue-800 focus:bg-white transition-colors"
            >
              <option value="all">Unified (Medicals + Clinic Visits)</option>
              <option value="certificate">Medical Certificates Only</option>
              <option value="visit">Clinic Visits Only</option>
            </select>
          </div>
        </div>

        {/* Minimalist 1-Line Status & Recipient Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-gray-100 text-xs text-gray-600">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Recipients:</span>
            <span className="font-medium text-gray-800">CMIS • ELTN • MATH • IM</span>
            <span className="text-gray-400">· Faculty of Applied Sciences</span>
          </div>
          {dispatchedAt && (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full w-fit">
              ✓ Last Dispatched: {dispatchedAt}
            </span>
          )}
        </div>

        {/* Dispatch Confirmation Banner */}
        {dispatchSuccessMsg && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{dispatchSuccessMsg}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="print:hidden p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          {error}
        </div>
      )}

      {/* DOCUMENT SHEET (Matches Physical University Document Format) */}
      <div className="bg-white p-6 sm:p-10 border border-gray-200 rounded-2xl shadow-sm print:p-0 print:border-none print:shadow-none print:m-0">
        <style>{`
          @media print {
            body { background: white !important; font-size: 11pt !important; color: black !important; }
            .portal-sidebar, .portal-header, .portal-footer, aside, header, footer { display: none !important; }
            .portal-shell, .portal-frame, .portal-content { margin: 0 !important; padding: 0 !important; }
            @page { size: A4 portrait; margin: 15mm 12mm 15mm 12mm; }
            .print-table th, .print-table td { border: 1px solid black !important; }
          }
        `}</style>

        {/* Document Header */}
        <div className="text-center mb-6">
          <h2 className="text-base sm:text-lg font-bold tracking-wide text-gray-900 uppercase">
            DETAILS OF STUDENTS MEDICAL CERTIFICATE
          </h2>
          <div className="text-sm font-semibold text-gray-800 mt-1 uppercase">
            {formattedHeaderDate}
          </div>
          <div className="text-xs sm:text-sm font-bold text-gray-900 mt-0.5 uppercase tracking-wider">
            FACULTY OF APPLIED SCIENCES
          </div>
          {selectedBatch !== 'All' && selectedBatch !== 'All Batches' && (
            <div className="text-xs font-semibold text-blue-900 mt-1 uppercase">
              [{selectedBatch}]
            </div>
          )}
        </div>

        {/* Tabular Schedule */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-900 text-xs text-left print-table">
            <thead>
              <tr className="bg-gray-50 print:bg-transparent font-bold text-gray-900 border-b border-gray-900">
                <th className="border border-gray-900 px-2.5 py-2 w-12 text-center">SR NO</th>
                <th className="border border-gray-900 px-3 py-2 w-1/4">NAME AND REGISTRATION NUMBER</th>
                <th className="border border-gray-900 px-3 py-2 w-1/4 text-center">DURATION OF LEAVE</th>
                <th className="border border-gray-900 px-2.5 py-2 w-20 text-center">NUMBER OF HOLIDAYS</th>
                <th className="border border-gray-900 px-2.5 py-2 w-20 text-center">NUMBER OF LEAVE DYS</th>
                <th className="border border-gray-900 px-3 py-2">
                  DETAILS OF TAKEN PREVIOUS (THOSE WHO HAVE CEDED 08 DAYS LEAVE PER MONTHLY)
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="border border-gray-900 py-8 text-center text-gray-400">
                    Loading attendance records...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border border-gray-900 py-8 text-center text-gray-400">
                    No approved attendance or medical records found for the selected filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const studentIndex = item.indexNo
                  const totalDaysInMonth = monthlyStudentLeaveMap.get(`${studentIndex}-${item.leaveMonth}`) || item.leaveDays
                  const hasExceeded8Days = totalDaysInMonth > 8

                  return (
                    <tr key={item.id} className="border-b border-gray-900 align-top">
                      {/* SR NO */}
                      <td className="border border-gray-900 px-2.5 py-2.5 text-center font-medium">
                        {String(index + 1).padStart(2, '0')}
                      </td>

                      {/* NAME AND REGISTRATION NUMBER */}
                      <td className="border border-gray-900 px-3 py-2.5">
                        <div className="font-semibold text-gray-900">{item.studentName}</div>
                        <div className="text-gray-700 font-mono mt-0.5">{item.indexNo}</div>
                      </td>

                      {/* DURATION OF LEAVE */}
                      <td className="border border-gray-900 px-3 py-2.5 text-center font-mono text-[11px] whitespace-pre-line">
                        {item.durationStr}
                      </td>

                      {/* NUMBER OF HOLIDAYS */}
                      <td className="border border-gray-900 px-2.5 py-2.5 text-center font-medium">
                        {item.holidays > 0 ? String(item.holidays).padStart(2, '0') : ''}
                      </td>

                      {/* NUMBER OF LEAVE DYS */}
                      <td className="border border-gray-900 px-2.5 py-2.5 text-center font-medium">
                        {String(item.leaveDays).padStart(2, '0')}
                      </td>

                      {/* DETAILS OF TAKEN PREVIOUS */}
                      <td className="border border-gray-900 px-3 py-2.5 text-[11px] text-gray-800">
                        {hasExceeded8Days ? (
                          <div className="font-semibold text-amber-800 print:text-black">
                            Exceeded 8 days ({totalDaysInMonth} days total in {item.leaveMonth})
                          </div>
                        ) : item.previousNote ? (
                          <div>{item.previousNote}</div>
                        ) : (
                          ''
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Document Footer (Official Medical Officer Stamp Block) */}
        <div className="mt-12 flex justify-end">
          <div className="text-center w-72 border-t-2 border-gray-800 pt-2 print:border-gray-900">
            <div className="font-bold text-xs uppercase text-gray-900">Medical Officer</div>
            <div className="text-xs text-gray-700">Wayamba University of Sri Lanka</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Kuliyapitiya Campus</div>
            <div className="text-[10px] text-emerald-800 print:text-gray-600 mt-1 font-semibold">
              {dispatchedAt ? `Officially Dispatched on ${dispatchedAt}` : 'Verified & Ready for Dispatch'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
