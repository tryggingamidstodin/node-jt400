package nodejt400;

import java.sql.Connection;

import com.ibm.as400.access.AS400;
import com.ibm.as400.access.AS400JDBCConnectionHandle;
import com.ibm.as400.access.IFSFile;
import com.ibm.as400.access.IFSFileOutputStream;

public class IfsWriteStream {

	private ConnectionProvider connectionProvider;
	private final Connection connection;
	private final IFSFileOutputStream fos;
	private boolean closed = false;

	public IfsWriteStream(ConnectionProvider connectionProvider, String folderPath, String fileName, boolean append,
			Integer ccsid)
			throws Exception {
		this.connectionProvider = connectionProvider;
		connection = connectionProvider.getConnection();
		boolean opened = false;
		try {
			AS400JDBCConnectionHandle handle = (AS400JDBCConnectionHandle) connection;
			AS400 as400 = handle.getSystem();
			IFSFile folder = new IFSFile(as400, folderPath);
			if (!folder.exists()) {
				folder.mkdirs();
			}

			IFSFile file = new IFSFile(as400, folder, fileName);

			if (ccsid == null) {
				fos = new IFSFileOutputStream(file, IFSFileOutputStream.SHARE_ALL, append);
			} else {
				fos = new IFSFileOutputStream(file, IFSFileOutputStream.SHARE_ALL, append, ccsid.intValue());
			}
			opened = true;
		} finally {
			if (!opened) {
				// The caller never receives this object, so flush() will never
				// run and nothing else can return the connection.
				closed = true;
				try {
					connectionProvider.returnConnection(connection);
				} catch (Exception ignore) {
					// Never mask the failure the caller is about to see.
				}
			}
		}
	}

	public void write(byte[] data) throws Exception {
		fos.write(data);
		fos.flush();
	}

	public void flush() throws Exception {
		if (closed) {
			return;
		}
		closed = true;
		try {
			try {
				fos.flush();
			} finally {
				fos.close();
			}
		} finally {
			this.connectionProvider.returnConnection(this.connection);
		}
	}
}
