package nodejt400;

import java.sql.Connection;

import com.ibm.as400.access.AS400;
import com.ibm.as400.access.AS400JDBCConnectionHandle;
import com.ibm.as400.access.DataQueue;
import com.ibm.as400.access.DataQueueEntry;
import com.ibm.as400.access.QSYSObjectPathName;

/**
 * A plain (sequential, non-keyed) data queue. Entries are read in the order
 * the queue was created with (FIFO or LIFO).
 */
public class DataQ {

	private final ConnectionProvider connectionProvider;

	private final String path;

	public DataQ(ConnectionProvider connectionProvider, String name, Boolean isPath) {
		this.connectionProvider = connectionProvider;
		if (isPath) {
			this.path = name;
		} else {
			this.path = QSYSObjectPathName.toPath("*LIBL", name, "DTAQ");
		}
	}

	private DataQueue openDataQ(Connection c) throws Exception {
		AS400JDBCConnectionHandle handle = (AS400JDBCConnectionHandle) c;
		AS400 as400 = handle.getSystem();
		return new DataQueue(as400, path);
	}

	/**
	 * Removes the next entry from the queue and returns it.
	 *
	 * @param wait seconds to wait for an entry, 0 to not wait and -1 to wait
	 *             until there is one
	 * @return the entry, or null when the queue had no entry within the wait
	 */
	public String read(int wait) throws Exception {
		Connection c = connectionProvider.getConnection();
		try {
			DataQueueEntry entry = openDataQ(c).read(wait);
			return entry == null ? null : entry.getString();
		} finally {
			connectionProvider.returnConnection(c);
		}
	}

	/**
	 * Returns the next entry without removing it from the queue.
	 *
	 * @param wait seconds to wait for an entry, 0 to not wait and -1 to wait
	 *             until there is one
	 * @return the entry, or null when the queue had no entry within the wait
	 */
	public String peek(int wait) throws Exception {
		Connection c = connectionProvider.getConnection();
		try {
			DataQueueEntry entry = openDataQ(c).peek(wait);
			return entry == null ? null : entry.getString();
		} finally {
			connectionProvider.returnConnection(c);
		}
	}

	public void write(String data) throws Exception {
		Connection c = connectionProvider.getConnection();
		try {
			openDataQ(c).write(data);
		} finally {
			connectionProvider.returnConnection(c);
		}
	}

}
