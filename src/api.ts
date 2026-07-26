const API_BASE = 'https://open.api.nexon.com/maplestory/v1'

export type CharacterBasic = {
  character_name: string
  world_name: string
  character_class: string
  character_level: number
  character_image: string
}

type CharacterId = {
  ocid: string
}

type NexonError = {
  message?: string
  error?: {
    message?: string
  }
}

async function request<T>(path: string): Promise<T> {
  const apiKey = import.meta.env.VITE_NEXON_API_KEY

  if (!apiKey) {
    throw new Error('.env.local에 VITE_NEXON_API_KEY를 설정해 주세요.')
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'x-nxopen-api-key': apiKey,
    },
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as NexonError | null
    throw new Error(
      body?.message ?? body?.error?.message ?? `API 요청 실패 (${response.status})`,
    )
  }

  return response.json() as Promise<T>
}

export async function getCharacter(name: string): Promise<CharacterBasic> {
  const { ocid } = await request<CharacterId>(
    `/id?character_name=${encodeURIComponent(name)}`,
  )

  return request<CharacterBasic>(
    `/character/basic?ocid=${encodeURIComponent(ocid)}`,
  )
}
