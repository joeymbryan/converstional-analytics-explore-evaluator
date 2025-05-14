import { Looker40SDK } from '@looker/sdk'
import { IArtifact, IRequestSearchArtifacts } from '@looker/sdk'

interface StorageStats {
  max_size: number
  usage: number
}

export class ArtifactStorage {
  private sdk: Looker40SDK
  private readonly namespace = 'explorewise'

  constructor(sdk: Looker40SDK) {
    this.sdk = sdk
  }

  async getStorageStats(): Promise<StorageStats> {
    try {
      // @ts-ignore: Looker SDK type mismatch
      const response = await this.sdk.ok(
        this.sdk.artifact_usage()
      )
      return response as StorageStats
    } catch (error) {
      console.error('Error fetching artifact storage stats:', error)
      throw error
    }
  }

  async saveAnalysisResult(exploreName: string, result: any): Promise<void> {
    try {
      const key = `explore_analysis_${exploreName}`
      let version: string | undefined = undefined
      // Try to fetch the current artifact to get its version
      try {
        // @ts-ignore: Looker SDK type mismatch
        const current = await this.sdk.ok(
          this.sdk.artifact({
            key,
            namespace: this.namespace
          })
        )
        // Debug log: print the current artifact object and version
        // eslint-disable-next-line no-console
        console.log('DEBUG: current artifact object:', current)
        if (Array.isArray(current) && current.length > 0 && 'version' in current[0]) {
          // eslint-disable-next-line no-console
          console.log('DEBUG: extracted version:', current[0].version)
          version = current[0].version !== undefined ? String(current[0].version) : undefined
        } else if (current && typeof current === 'object' && 'version' in current) {
          // eslint-disable-next-line no-console
          console.log('DEBUG: extracted version:', current.version)
          version = (current as any).version !== undefined ? String((current as any).version) : undefined
        }
      } catch (err) {
        // If not found, that's fine (new artifact)
      }
      // @ts-ignore: Looker SDK type mismatch
      await this.sdk.ok(
        this.sdk.update_artifacts(
          this.namespace,
          [
            {
              key,
              value: JSON.stringify(result),
              content_type: 'application/json',
              ...(version ? { version: Number(version) } : {})
            }
          ]
        )
      )
    } catch (error) {
      console.error('Error saving analysis result:', error)
      throw error
    }
  }

  async getAnalysisResult(exploreName: string): Promise<any | null> {
    try {
      // @ts-ignore: Looker SDK type mismatch
      const response = await this.sdk.ok(
        this.sdk.artifact({
          key: `explore_analysis_${exploreName}`,
          namespace: this.namespace
        })
      )
      
      if (response && typeof response === 'object' && 'content' in response) {
        return JSON.parse(response.content as string)
      }
      return null
    } catch (error) {
      if ((error as any).message?.includes('Not Found')) {
        return null
      }
      console.error('Error fetching analysis result:', error)
      throw error
    }
  }

  async listSavedAnalyses(): Promise<string[]> {
    try {
      const searchParams: IRequestSearchArtifacts = {
        key: 'explore_analysis_%',
        namespace: this.namespace
      }
      
      // @ts-ignore: Looker SDK type mismatch
      const artifacts = await this.sdk.ok(
        this.sdk.search_artifacts(searchParams)
      )
      
      if (Array.isArray(artifacts)) {
        return artifacts
          .filter(artifact => artifact.key.startsWith('explore_analysis_'))
          .map(artifact => artifact.key.replace('explore_analysis_', ''))
      }
      return []
    } catch (error) {
      console.error('Error listing saved analyses:', error)
      throw error
    }
  }
} 