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
		IFSFileOutputStream stream = null;
		try {
			AS400JDBCConnectionHandle handle = (AS400JDBCConnectionHandle) connection;
			AS400 as400 = handle.getSystem();
			IFSFile folder = new IFSFile(as400, folderPath);
			if (!folder.exists()) {
				folder.mkdirs();
			}

			IFSFile file = new IFSFile(as400, folder, fileName);

			if (ccsid == null) {
				stream = new IFSFileOutputStream(file, IFSFileOutputStream.SHARE_ALL, append);
			} else {
				stream = new IFSFileOutputStream(file, IFSFileOutputStream.SHARE_ALL, append, ccsid.intValue());
			}
		} catch (Exception e) {
			connectionProvider.returnConnection(connection);
			throw e;
		}
		fos = stream;
	}

	public synchronized void write(byte[] data) throws Exception {
		fos.write(data);
		fos.flush();
	}

	public synchronized void flush() throws Exception {
		try {
			fos.flush();
		} finally {
			close();
		}
	}

	public synchronized void close() throws Exception {
		if (closed) {
			return;
		}
		closed = true;
		try {
			fos.close();
		} finally {
			connectionProvider.returnConnection(connection);
		}
	}
}
