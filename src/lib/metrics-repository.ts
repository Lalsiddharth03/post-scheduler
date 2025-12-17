import { SchedulerMetrics } from './types'
import { createServiceClient } from './supabase/server'

export interface MetricsRepository {
  saveMetrics(metrics: SchedulerMetrics): Promise<boolean>
  getMetrics(executionId: string): Promise<SchedulerMetrics | null>
  getRecentMetrics(limit?: number): Promise<SchedulerMetrics[]>
  getMetricsByDateRange(startDate: string, endDate: string): Promise<SchedulerMetrics[]>
}

export class SupabaseMetricsRepository implements MetricsRepository {
  private supabase = createServiceClient()

  async saveMetrics(metrics: SchedulerMetrics): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('scheduler_metrics')
        .insert({
          execution_id: metrics.execution_id,
          started_at: metrics.started_at,
          completed_at: metrics.completed_at,
          posts_processed: metrics.posts_processed,
          posts_published: metrics.posts_published,
          errors_encountered: metrics.errors_encountered,
          execution_duration_ms: metrics.execution_duration_ms
        })

      if (error) {
        console.error('Failed to save scheduler metrics:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error saving scheduler metrics:', error)
      return false
    }
  }

  async getMetrics(executionId: string): Promise<SchedulerMetrics | null> {
    try {
      const { data, error } = await this.supabase
        .from('scheduler_metrics')
        .select('*')
        .eq('execution_id', executionId)
        .single()

      if (error || !data) {
        return null
      }

      return {
        execution_id: data.execution_id,
        started_at: data.started_at,
        completed_at: data.completed_at,
        posts_processed: data.posts_processed,
        posts_published: data.posts_published,
        errors_encountered: data.errors_encountered,
        execution_duration_ms: data.execution_duration_ms
      }
    } catch (error) {
      console.error('Error retrieving scheduler metrics:', error)
      return null
    }
  }

  async getRecentMetrics(limit = 10): Promise<SchedulerMetrics[]> {
    try {
      const { data, error } = await this.supabase
        .from('scheduler_metrics')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit)

      if (error || !data) {
        return []
      }

      return data.map(row => ({
        execution_id: row.execution_id,
        started_at: row.started_at,
        completed_at: row.completed_at,
        posts_processed: row.posts_processed,
        posts_published: row.posts_published,
        errors_encountered: row.errors_encountered,
        execution_duration_ms: row.execution_duration_ms
      }))
    } catch (error) {
      console.error('Error retrieving recent scheduler metrics:', error)
      return []
    }
  }

  async getMetricsByDateRange(startDate: string, endDate: string): Promise<SchedulerMetrics[]> {
    try {
      const { data, error } = await this.supabase
        .from('scheduler_metrics')
        .select('*')
        .gte('started_at', startDate)
        .lte('started_at', endDate)
        .order('started_at', { ascending: false })

      if (error || !data) {
        return []
      }

      return data.map(row => ({
        execution_id: row.execution_id,
        started_at: row.started_at,
        completed_at: row.completed_at,
        posts_processed: row.posts_processed,
        posts_published: row.posts_published,
        errors_encountered: row.errors_encountered,
        execution_duration_ms: row.execution_duration_ms
      }))
    } catch (error) {
      console.error('Error retrieving scheduler metrics by date range:', error)
      return []
    }
  }
}

// Singleton instance
export const metricsRepository = new SupabaseMetricsRepository()