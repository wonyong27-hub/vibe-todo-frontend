import { useState, useEffect } from 'react'
import './App.css'

// 백엔드 API 경로 (환경변수에서 가져오기)
// 환경변수가 없을 경우 기본값 사용
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://vibe-todo-backend1-45443a5ea80b.herokuapp.com'
const API_PATH = import.meta.env.VITE_API_PATH || '/todos'

// API_URL 생성: 중복 방지
// API_BASE_URL이 이미 /todos로 끝나면 그대로 사용, 아니면 API_PATH 추가
const API_URL = API_BASE_URL.endsWith('/todos') 
  ? API_BASE_URL 
  : `${API_BASE_URL}${API_PATH.startsWith('/') ? API_PATH : `/${API_PATH}`}`

// 디버깅: 환경변수 확인
console.log('환경변수 확인:')
console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL)
console.log('VITE_API_PATH:', import.meta.env.VITE_API_PATH)
console.log('API_BASE_URL (최종):', API_BASE_URL)
console.log('API_URL (최종):', API_URL)

function App() {
  const [todos, setTodos] = useState([])
  const [newTodo, setNewTodo] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // 할일 목록 가져오기
  const fetchTodos = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        // 에러 응답 본문을 자세히 확인
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { message: errorText || `서버 오류가 발생했습니다. (${response.status})` }
        }
        console.error('할일 조회 오류 응답:', errorData)
        throw new Error(errorData.message || errorData.error || `할일을 불러오는데 실패했습니다. (${response.status})`)
      }
      
      const data = await response.json()
      // 응답이 배열인지 확인하고, 배열이 아니면 빈 배열로 설정
      if (Array.isArray(data)) {
        setTodos(data)
      } else if (data && Array.isArray(data.todos)) {
        // 응답이 { todos: [...] } 형태인 경우
        setTodos(data.todos)
      } else if (data && data.data && Array.isArray(data.data)) {
        // 응답이 { data: [...] } 형태인 경우
        setTodos(data.data)
      } else {
        console.warn('예상치 못한 응답 형식:', data)
        setTodos([])
      }
      setError(null) // 성공 시 에러 초기화
    } catch (err) {
      // CORS 또는 네트워크 오류 처리
      if (err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('Failed to fetch'))) {
        setError(`백엔드 서버(${API_BASE_URL})에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요. (CORS 오류일 수 있습니다)`)
      } else if (err.message.includes('CORS')) {
        setError(`CORS 오류: 백엔드 서버에서 CORS를 허용하도록 설정해야 합니다. (${API_URL})`)
      } else {
        setError(err.message || '할일을 불러오는데 실패했습니다.')
      }
      console.error('할일 조회 오류:', err)
      console.error('API URL:', API_URL)
      setTodos([]) // 오류 시 빈 배열로 설정
    } finally {
      setLoading(false)
    }
  }

  // 컴포넌트 마운트 시 할일 목록 가져오기
  useEffect(() => {
    fetchTodos()
  }, [])

  // 할일 추가
  const handleAddTodo = async (e) => {
    e.preventDefault()
    if (!newTodo.trim()) return

    try {
      setError(null)
      // 백엔드가 요구하는 형식에 맞춰 요청 본문 생성
      const requestBody = {
        title: newTodo.trim(),
        text: newTodo.trim(), // 일부 백엔드는 'text' 필드를 요구할 수 있음
        completed: false,
      }
      
      console.log('할일 추가 요청:', requestBody)
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        // 에러 응답 본문을 자세히 확인
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { message: errorText || `서버 오류가 발생했습니다. (${response.status})` }
        }
        console.error('할일 추가 오류 응답:', errorData)
        throw new Error(errorData.message || errorData.error || `할일 추가에 실패했습니다. (${response.status})`)
      }

      const savedTodo = await response.json()
      console.log('할일 추가 성공 (MongoDB에 저장됨):', savedTodo)
      // MongoDB에 저장된 최신 데이터를 가져오기 위해 목록 새로고침
      await fetchTodos()
      setNewTodo('')
      setError(null) // 성공 시 에러 초기화
    } catch (err) {
      if (err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('Failed to fetch'))) {
        setError(`백엔드 서버(${API_BASE_URL})에 연결할 수 없습니다.`)
      } else {
        setError(err.message || '할일 추가에 실패했습니다.')
      }
      console.error('할일 추가 오류:', err)
    }
  }

  // 할일 수정 시작
  const startEditing = (todo) => {
    const todoId = todo._id || todo.id
    if (!todoId) {
      console.error('할일 ID가 없습니다:', todo)
      // ID가 없어도 수정 모드로 전환 (로컬에서만 수정 가능)
      setEditingId(todo)
      setEditingText(todo.title || todo.text || '')
      return
    }
    setEditingId(todoId)
    setEditingText(todo.title || todo.text || '')
  }

  // 할일 수정 취소
  const cancelEditing = () => {
    setEditingId(null)
    setEditingText('')
  }

  // 할일 수정 저장
  const handleUpdateTodo = async (id, updatedData) => {
    try {
      setError(null)
      
      // ID가 객체인 경우 (ID가 없는 경우) 처리
      if (typeof id === 'object' || !id) {
        console.error('할일 ID가 없어 서버에 수정 요청을 보낼 수 없습니다:', id)
        setError('할일 ID가 없어 수정할 수 없습니다. 새로고침 후 다시 시도해주세요.')
        setEditingId(null)
        setEditingText('')
        return
      }
      
      // 수정 시 title과 text 필드를 모두 업데이트
      const requestBody = {
        ...updatedData,
        title: updatedData.title || updatedData.text || '',
        text: updatedData.title || updatedData.text || '',
      }
      
      console.log('할일 수정 요청:', requestBody)
      console.log('수정할 ID:', id)
      
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        // 에러 응답 본문을 자세히 확인
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { message: errorText || `서버 오류가 발생했습니다. (${response.status})` }
        }
        console.error('할일 수정 오류 응답:', errorData)
        throw new Error(errorData.message || errorData.error || `할일 수정에 실패했습니다. (${response.status})`)
      }

      const updatedTodo = await response.json()
      console.log('할일 수정 성공 (MongoDB에 저장됨):', updatedTodo)
      // MongoDB에 저장된 최신 데이터를 가져오기 위해 목록 새로고침
      await fetchTodos()
      setEditingId(null)
      setEditingText('')
      setError(null) // 성공 시 에러 초기화
    } catch (err) {
      if (err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('Failed to fetch'))) {
        setError(`백엔드 서버(${API_BASE_URL})에 연결할 수 없습니다.`)
      } else {
        setError(err.message)
      }
      console.error('할일 수정 오류:', err)
    }
  }

  // 완료 상태 토글
  const handleToggleComplete = async (todo) => {
    const todoId = todo._id || todo.id
    if (!todoId) {
      console.error('할일 ID가 없습니다:', todo)
      setError('할일 ID가 없어 상태를 변경할 수 없습니다.')
      return
    }
    await handleUpdateTodo(todoId, {
      ...todo,
      completed: !todo.completed,
    })
  }

  // 할일 삭제
  const handleDeleteTodo = async (id) => {
    if (!id) {
      console.error('삭제할 할일의 ID가 없습니다.')
      setError('삭제할 할일의 ID가 없습니다.')
      return
    }

    if (!window.confirm('정말 삭제하시겠습니까?')) return

    try {
      setError(null)
      console.log('할일 삭제 요청:', id)
      console.log('API URL:', `${API_URL}/${id}`)
      
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        // 에러 응답 본문을 자세히 확인
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { message: errorText || `서버 오류가 발생했습니다. (${response.status})` }
        }
        console.error('할일 삭제 오류 응답:', errorData)
        throw new Error(errorData.message || errorData.error || `할일 삭제에 실패했습니다. (${response.status})`)
      }

      // 응답 본문 확인 (성공 메시지가 있을 수 있음)
      try {
        const responseData = await response.json()
        console.log('할일 삭제 성공 응답:', responseData)
      } catch {
        // 응답 본문이 없어도 정상 (204 No Content 등)
        console.log('할일 삭제 성공 (MongoDB에서 삭제됨):', id)
      }

      // MongoDB에서 삭제된 최신 데이터를 가져오기 위해 목록 새로고침
      await fetchTodos()
      setError(null) // 성공 시 에러 초기화
    } catch (err) {
      if (err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('Failed to fetch'))) {
        setError(`백엔드 서버(${API_BASE_URL})에 연결할 수 없습니다.`)
      } else {
        setError(err.message)
      }
      console.error('할일 삭제 오류:', err)
    }
  }

  return (
    <div className="app">
      <div className="container">
        <h1 className="title">할일 관리</h1>

        {/* 에러 메시지 */}
        {error && (
          <div className="error-message">
            <strong>오류:</strong> {error}
            <button 
              onClick={() => fetchTodos()} 
              className="retry-button"
              style={{ marginLeft: '10px', padding: '4px 8px', fontSize: '0.9rem' }}
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 할일 추가 폼 */}
        <form onSubmit={handleAddTodo} className="todo-form">
          <input
            type="text"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="할일을 입력하세요..."
            className="todo-input"
          />
          <button type="submit" className="add-button">
            추가
          </button>
        </form>

        {/* 할일 목록 */}
        {loading ? (
          <div className="loading">로딩 중...</div>
        ) : todos.length === 0 && !error ? (
          <div className="empty-state">할일이 없습니다.</div>
        ) : todos.length > 0 ? (
          <ul className="todo-list">
            {todos
              .filter(todo => {
                // ID가 없는 항목은 필터링하지 않고 표시 (다만 수정/삭제 시 문제가 될 수 있음)
                return todo
              })
              .map((todo) => {
              const todoId = todo._id || todo.id
              // 수정 모드 확인: todoId가 있으면 ID로 비교, 없으면 객체 자체로 비교
              const isEditing = todoId ? editingId === todoId : editingId === todo
              return (
                <li key={todoId || Math.random()} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
                  {isEditing ? (
                  // 수정 모드
                  <div className="edit-form">
                    <input
                      type="text"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="edit-input"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        if (!editingText.trim()) {
                          alert('할일 내용을 입력해주세요.')
                          return
                        }
                        const updateId = todoId || todo
                        if (!updateId || (typeof updateId !== 'string' && typeof updateId !== 'object')) {
                          alert('할일 ID가 없어 수정할 수 없습니다.')
                          return
                        }
                        handleUpdateTodo(updateId, {
                          ...todo,
                          title: editingText.trim(),
                          text: editingText.trim(),
                        })
                      }}
                      className="save-button"
                    >
                      저장
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="cancel-button"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  // 보기 모드
                  <>
                    <div className="todo-content">
                      <span className="todo-text">{todo.title || todo.text || ''}</span>
                    </div>
                    <div className="todo-actions">
                      <button
                        onClick={() => startEditing(todo)}
                        className="edit-button"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => {
                          const todoId = todo._id || todo.id
                          if (!todoId) {
                            console.error('할일 ID가 없습니다:', todo)
                            setError('할일 ID가 없어 삭제할 수 없습니다.')
                            return
                          }
                          handleDeleteTodo(todoId)
                        }}
                        className="delete-button"
                      >
                        삭제
                      </button>
                    </div>
                  </>
                  )}
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

export default App
