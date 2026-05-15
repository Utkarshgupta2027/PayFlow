export default function UserAvatar({ user, name, src, size = '2.25rem', fontSize = '0.875rem', style = {} }) {
  const displayName = name || user?.name || ''
  const imageSrc = src || user?.profilePictureUrl
  const initials = displayName
    ? displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize,
        overflow: 'hidden',
        flexShrink: 0,
        ...style,
      }}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : initials}
    </div>
  )
}
